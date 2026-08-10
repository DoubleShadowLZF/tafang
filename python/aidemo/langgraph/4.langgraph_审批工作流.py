import os
from dotenv import load_dotenv
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.types import Command, interrupt
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, AIMessage
from typing import Literal

load_dotenv()


def request_node(state: MessagesState) -> dict:
    """接收用户请求"""
    # 提取最后一条用户消息
    last_msg = state["messages"][-1]
    if isinstance(last_msg, HumanMessage):
        content = last_msg.content
    else:
        content = str(last_msg)

    print(f"[请求节点] 收到用户请求: {content}")
    return {"messages": state["messages"]}


def approval_node(state: MessagesState) -> dict:
    """审批节点：暂停等待人工审批"""
    # 获取最后一条消息（用户请求）
    last_msg = state["messages"][-1]
    if isinstance(last_msg, HumanMessage):
        action_content = last_msg.content
    else:
        action_content = str(last_msg)

    print(f"[审批节点] 等待审批: {action_content}")

    # 暂停执行，等待人工决策
    human_decision = interrupt({
        "question": "是否批准执行以下操作？",
        "action": action_content,
        "options": ["approve", "reject"]
    })

    # 处理审批结果
    if human_decision == "approve":
        print("[审批节点] ✅ 操作已批准")
        return {"messages": [AIMessage(content=f"✅ 操作已批准：{action_content}")]}
    elif human_decision == "reject":
        print("[审批节点] ❌ 操作已被拒绝")
        return {"messages": [AIMessage(content="❌ 操作已被拒绝。")]}
    else:
        print(f"[审批节点] ⚠️ 收到未知指令: {human_decision}")
        return {"messages": [AIMessage(content="⚠️ 收到未知指令，默认拒绝。")]}


def execute_node(state: MessagesState) -> dict:
    """执行节点"""
    # 检查是否已批准
    last_msg = state["messages"][-1]
    if "已批准" in last_msg.content:
        print("[执行节点] 🚀 开始执行任务...")
        # 这里可以添加实际执行逻辑
        return {"messages": [AIMessage(content="✅ 任务执行完成！")]}
    else:
        print("[执行节点] ⏭️ 任务未批准，跳过执行")
        return {"messages": [AIMessage(content="⏭️ 任务已被拒绝，无需执行。")]}


# 构建图
builder = StateGraph(MessagesState)
builder.add_node("request", request_node)
builder.add_node("approval", approval_node)
builder.add_node("execute", execute_node)

builder.add_edge(START, "request")
builder.add_edge("request", "approval")
builder.add_edge("approval", "execute")
builder.add_edge("execute", END)

# 使用 checkpointer 编译图
checkpointer = MemorySaver()
graph = builder.compile(checkpointer=checkpointer)


def run_approval_workflow(user_request: str, decision: Literal["approve", "reject"] = "approve"):
    """
    运行审批工作流

    Args:
        user_request: 用户请求内容
        decision: 审批决策 ("approve" 或 "reject")
    """
    config = {"configurable": {"thread_id": "approval-session-001"}}

    print("=" * 60)
    print("🚀 启动工作流")
    print("=" * 60)

    # Step 1: 启动图，会在 interrupt 处暂停
    print("\n📤 Step 1: 提交请求")
    result = graph.invoke(
        {"messages": [HumanMessage(content=user_request)]},
        config=config
    )

    # 检查是否在中断点
    print("⏸️ 图已暂停，等待审批...")
    print(f"📋 待审批操作: {user_request}")

    # Step 2: 人工审批后，用 Command 恢复执行
    print(f"\n📝 Step 2: 人工审批 ({decision})")
    try:
        result = graph.invoke(
            Command(resume=decision),
            config=config
        )

        # 提取最终结果
        final_message = result['messages'][-1]
        if isinstance(final_message, AIMessage):
            final_content = final_message.content
        else:
            final_content = str(final_message)

        print(f"\n✅ 最终结果: {final_content}")
        return result
    except Exception as e:
        print(f"\n❌ 执行失败: {e}")
        raise


# 主程序
if __name__ == "__main__":
    print("=" * 60)
    print("📋 人工审批工作流示例")
    print("=" * 60)

    # 示例1：批准操作
    print("\n【示例1：批准操作】")
    run_approval_workflow(
        user_request="请删除数据库中的所有测试数据",
        decision="approve"
    )

    print("\n" + "=" * 60 + "\n")

    # 示例2：拒绝操作（使用新的 thread_id）
    print("\n【示例2：拒绝操作】")
    config_reject = {"configurable": {"thread_id": "approval-session-002"}}
    print("📤 Step 1: 提交请求")
    result = graph.invoke(
        {"messages": [HumanMessage(content="请清空生产环境的日志文件")]},
        config=config_reject
    )
    print("⏸️ 图已暂停，等待审批...")
    print("\n📝 Step 2: 人工审批 (reject)")
    result = graph.invoke(
        Command(resume="reject"),
        config=config_reject
    )
    final_msg = result['messages'][-1]
    print(f"✅ 最终结果: {final_msg.content}")