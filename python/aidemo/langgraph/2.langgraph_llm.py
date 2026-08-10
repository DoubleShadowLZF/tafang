# 在 Jupyter Notebook 中可视化
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core.models import SystemMessage, UserMessage, AssistantMessage
import asyncio

# 创建模型客户端
model_client = OpenAIChatCompletionClient(
    model="DeepSeek-R1-Distill-Qwen-7B-Q4_K_M",
    base_url="http://localhost:11434/v1",
    api_key="ollama",
    model_info={
        "vision": False,
        "function_calling": True,
        "json_output": True,
        "family": "deepseek"
    }
)


async def llm_node(state: dict) -> dict:
    """调用 LLM 的节点（异步版本）"""
    # 创建系统消息
    system_prompt = SystemMessage(content="你是一个有帮助的助手。")

    # 将系统提示与对话历史合并
    messages = [system_prompt] + state.get("messages", [])

    # 调用 LLM（异步）
    response = await model_client.create(messages)

    # 返回结果
    return {"messages": [response]}


# 同步版本的 llm_node（使用 asyncio.run）
def llm_node_sync(state: dict) -> dict:
    """调用 LLM 的节点（同步版本）"""
    return asyncio.run(llm_node(state))


# main 方法示例（异步版本）
async def main_async():
    """主函数示例（异步）"""
    # 初始化对话状态
    state = {
        "messages": [
            UserMessage(content="你好，请介绍一下Python编程语言。", source="user")
        ]
    }

    print("正在调用LLM...")
    print("输入消息:", state["messages"][0].content)
    print("-" * 50)

    # 调用 LLM 节点
    result = await llm_node(state)

    # 输出结果
    if result["messages"]:
        response_message = result["messages"][0]
        print("LLM响应:", response_message.content)

    # 多轮对话示例
    print("\n" + "=" * 50)
    print("多轮对话示例:")

    # 更新状态进行第二轮对话
    state["messages"].append(AssistantMessage(content=result["messages"][0].content, source="assistant"))
    state["messages"].append(UserMessage(content="Python适合初学者吗？", source="user"))

    # 再次调用
    result2 = await llm_node(state)
    if result2["messages"]:
        response_message2 = result2["messages"][0]
        print("第二轮LLM响应:", response_message2.content)


# 同步版本的 main
def main():
    """主函数（同步版本）"""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()