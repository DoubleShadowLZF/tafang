from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core.models import SystemMessage, UserMessage, AssistantMessage
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage as LCSystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END, MessagesState
from typing import List
import asyncio

load_dotenv()

# 1. 初始化 AutoGen 的 LLM 客户端
llm = OpenAIChatCompletionClient(
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

# 2. 辅助函数：将 LangChain 消息转换为 AutoGen 消息格式
def convert_to_autogen_messages(lc_messages: List) -> List:
    """将 LangChain 消息列表转换为 AutoGen 消息列表"""
    autogen_messages = []
    for msg in lc_messages:
        if isinstance(msg, LCSystemMessage):
            autogen_messages.append(SystemMessage(content=msg.content))
        elif isinstance(msg, HumanMessage):
            autogen_messages.append(UserMessage(content=msg.content, source="user"))
        elif isinstance(msg, AIMessage):
            autogen_messages.append(AssistantMessage(content=msg.content, source="assistant"))
        else:
            # 兜底处理，默认当作用户消息
            autogen_messages.append(UserMessage(content=str(msg), source="user"))
    return autogen_messages

# 3. 同步调用包装器
def sync_create_llm(autogen_messages: List):
    """同步调用 AutoGen LLM 的包装函数"""
    return asyncio.run(llm.create(autogen_messages))

# 4. 路由函数（保持不变）
def classify_intent(state: MessagesState) -> str:
    last_message = state["messages"][-1]
    content = last_message.content.lower()
    if "天气" in content or "温度" in content:
        return "weather_agent"
    elif "代码" in content or "编程" in content:
        return "code_agent"
    elif "再见" in content or "退出" in content:
        return "farewell"
    else:
        return "general_agent"

# 5. 定义各个 Agent 节点（核心修复点）
def router_node(state: MessagesState) -> dict:
    return {}

def weather_node(state: MessagesState) -> dict:
    # 将 LangChain 消息转为 AutoGen 格式，并添加系统提示
    autogen_messages = convert_to_autogen_messages([
        LCSystemMessage(content="你是一个天气助手，友好地回答天气相关问题。"),
        *state["messages"]
    ])
    # 调用 AutoGen 客户端获取响应
    response = sync_create_llm(autogen_messages)
    # 【修复】将 AutoGen 响应内容封装为 LangChain 的 AIMessage 对象
    return {"messages": [AIMessage(content=response.content)]}

def code_node(state: MessagesState) -> dict:
    autogen_messages = convert_to_autogen_messages([
        LCSystemMessage(content="你是一个编程助手，擅长解答代码问题。"),
        *state["messages"]
    ])
    response = sync_create_llm(autogen_messages)
    return {"messages": [AIMessage(content=response.content)]}  # 封装为 AIMessage

def general_node(state: MessagesState) -> dict:
    autogen_messages = convert_to_autogen_messages([
        LCSystemMessage(content="你是一个友善的 AI 助手。"),
        *state["messages"]
    ])
    response = sync_create_llm(autogen_messages)
    return {"messages": [AIMessage(content=response.content)]}  # 封装为 AIMessage

def farewell_node(state: MessagesState) -> dict:
    # 直接返回 LangChain 的 AIMessage
    return {"messages": [AIMessage(content="再见！期待下次与你交流。")]}

# 6. 构建图（与您的代码完全一致）
builder = StateGraph(MessagesState)
builder.add_node("router", router_node)
builder.add_node("weather_agent", weather_node)
builder.add_node("code_agent", code_node)
builder.add_node("general_agent", general_node)
builder.add_node("farewell", farewell_node)

builder.add_edge(START, "router")
builder.add_conditional_edges(
    "router",
    classify_intent,
    {
        "weather_agent": "weather_agent",
        "code_agent": "code_agent",
        "general_agent": "general_agent",
        "farewell": "farewell",
    }
)
for node in ["weather_agent", "code_agent", "general_agent", "farewell"]:
    builder.add_edge(node, END)

graph = builder.compile()

# 7. 测试
test_inputs = [
    "北京今天天气怎么样？",
    "帮我写一个 Python 快速排序",
    "你好，介绍一下你自己",
    "再见啦！"
]

for user_input in test_inputs:
    print(f"\n用户: {user_input}")
    # 输入使用 LangChain 的 HumanMessage
    result = graph.invoke({"messages": [HumanMessage(content=user_input)]})
    # 输出时，从 LangChain 的 AIMessage 中提取内容
    print(f"助手: {result['messages'][-1].content[:100]}...")
    print("-" * 50)