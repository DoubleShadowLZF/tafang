import asyncio
import logging
from io import BytesIO
from typing import List, Dict, Any

import PIL
import requests
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.messages import MultiModalMessage, TextMessage
from autogen_core import EVENT_LOGGER_NAME, CancellationToken
from autogen_core import Image
from autogen_ext.models.openai import OpenAIChatCompletionClient
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(EVENT_LOGGER_NAME)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


# ==================== 工具定义 ====================

async def web_search(query: str) -> str:
    """搜索网络信息"""
    return f"搜索结果：AutoGen 是一个用于构建多智能体应用的编程框架，由微软开发。"


async def calculator(expression: str) -> str:
    """计算器工具"""
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return f"计算结果：{expression} = {result}"
    except Exception as e:
        return f"计算错误：{str(e)}"


async def weather_query(city: str) -> str:
    """查询天气的工具"""
    return f"{city}的天气：晴天，温度25°C，湿度60%"


# ==================== 结构化输出模型 ====================

class SummaryOutput(BaseModel):
    """摘要输出的结构化模型"""
    title: str = Field(description="标题")
    key_points: List[str] = Field(description="关键点列表")
    sentiment: str = Field(description="情感倾向：positive/negative/neutral")


class ContactInfo(BaseModel):
    """联系人信息模型"""
    name: str = Field(description="姓名")
    email: str = Field(description="邮箱")
    phone: str = Field(description="电话")


# ==================== 演示函数 ====================

async def demo_basic_assistant():
    """1. 助手代理 - 基本的问答助手"""
    print("\n" + "=" * 60)
    print("演示1：基本助手代理")
    print("=" * 60)

    model_client = OpenAIChatCompletionClient(
        model="qwen2.5vl:3b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": True,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "family": "qwen"
        }
    )

    agent = AssistantAgent(
        name="assistant",
        model_client=model_client,
        system_message="你是一个有帮助的AI助手，用中文回答问题。",
    )

    task = "请简要介绍一下什么是人工智能？"
    result = await agent.run(task=task)
    print(f"任务：{task}")
    print(f"回答：{result.messages[-1].content}\n")


async def demo_multimodal_input():
    """2. 多模态输入 - 处理图像和文本"""
    print("\n" + "=" * 60)
    print("演示2：多模态输入（图像理解）")
    print("=" * 60)

    model_client = OpenAIChatCompletionClient(
        model="qwen2.5vl:3b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": True,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "family": "qwen"
        }
    )

    agent = AssistantAgent(
        name="vision_assistant",
        model_client=model_client,
        system_message="你是一个视觉助手，能够描述和分析图像内容。",
    )

    try:
        pil_image = PIL.Image.open(BytesIO(requests.get("https://picsum.photos/300/200").content))
        img = Image(pil_image)
        txt_context = "请详细描述这张图片的内容"
        multi_modal_message = MultiModalMessage(content=[txt_context, img], source="user")

        result = await agent.run(task=multi_modal_message)
        print(f"任务：{txt_context}")
        print(f"回答：{result.messages[-1].content}\n")
    except Exception as e:
        print(f"图像加载失败：{str(e)}\n")


async def demo_streaming_messages():
    """3. 流式消息 - 实时获取模型输出"""
    print("\n" + "=" * 60)
    print("演示3：流式消息输出")
    print("=" * 60)

    model_client = OpenAIChatCompletionClient(
        model="qwen2.5vl:3b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "family": "qwen"
        }
    )

    agent = AssistantAgent(
        name="streaming_assistant",
        model_client=model_client,
        system_message="你是一个有帮助的AI助手。",
    )

    task = "请用100字左右介绍Python编程语言的优势"
    print(f"任务：{task}")
    print("流式输出：")

    cancellation_token = CancellationToken()
    async for message in agent.on_messages_stream([TextMessage(content=task, source="user")], cancellation_token):
        if hasattr(message, 'content'):
            content = message.content if isinstance(message.content, str) else str(message.content)
            print(content, end="", flush=True)

    print("\n")


async def demo_with_tools():
    """4. 使用工具 - Agent调用外部工具"""
    print("\n" + "=" * 60)
    print("演示4：使用工具和工作台")
    print("=" * 60)

    # 注意：需要使用支持 function calling 的模型
    # 这里使用 mock 方式展示，实际使用时需要更换模型

    print("提示：Qwen2.5VL 不支持工具调用")
    print("如需使用工具，请切换到支持 function calling 的模型，如：")
    print("  - llama3.1:8b")
    print("  - qwen2.5:7b (非VL版本)")
    print("\n工具列表示例：")
    print("  - web_search: 网络搜索")
    print("  - calculator: 数学计算")
    print("  - weather_query: 天气查询\n")

    # 如果要用支持工具的模型，取消下面的注释并更换模型
    # model_client = OpenAIChatCompletionClient(
    #     model="llama3.1:8b",
    #     base_url="http://localhost:11434/v1",
    #     api_key="ollama",
    #     model_info={
    #         "vision": False,
    #         "function_calling": True,
    #         "json_output": True,
    #         "structured_output": False,
    #         "family": "llama"
    #     }
    # )
    #
    # agent = AssistantAgent(
    #     name="tool_assistant",
    #     model_client=model_client,
    #     tools=[web_search, calculator, weather_query],
    #     system_message="使用可用的工具来帮助用户解决问题。",
    # )
    #
    # task = "帮我计算 256 * 128 的结果"
    # result = await agent.run(task=task)
    # print(f"任务：{task}")
    # print(f"回答：{result.messages[-1].content}\n")


async def demo_structured_output():
    """5. 结构化输出 - 获取格式化的JSON响应"""
    print("\n" + "=" * 60)
    print("演示5：结构化输出")
    print("=" * 60)

    print("提示：需要使用支持 JSON 输出的模型")
    print("示例：提取文本中的关键信息并返回结构化数据\n")

    # 如果使用支持 structured output 的模型，可以这样写：
    # model_client = OpenAIChatCompletionClient(
    #     model="gpt-4o",
    #     model_info={
    #         "vision": False,
    #         "function_calling": True,
    #         "json_output": True,
    #         "structured_output": True,
    #         "family": "gpt-4"
    #     }
    # )
    #
    # agent = AssistantAgent(
    #     name="structured_agent",
    #     model_client=model_client,
    #     system_message="你是一个信息提取助手，将用户提供的文本转换为结构化格式。",
    # )
    #
    # task = "从以下文本中提取信息：张三，邮箱zhangsan@example.com，电话13800138000"
    # result = await agent.run(task=task, output_type=ContactInfo)
    # print(f"结构化结果：{result.messages[-1].content}\n")


async def demo_token_streaming():
    """6. 流式传输令牌 - Token级别的流式输出"""
    print("\n" + "=" * 60)
    print("演示6：流式传输令牌（Token Streaming）")
    print("=" * 60)

    model_client = OpenAIChatCompletionClient(
        model="qwen2.5vl:3b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "family": "qwen"
        }
    )

    agent = AssistantAgent(
        name="token_stream_agent",
        model_client=model_client,
        system_message="你是一个诗歌创作助手。",
    )

    task = "请创作一首关于春天的四句诗"
    print(f"任务：{task}")
    print("Token级别流式输出：")

    cancellation_token = CancellationToken()
    async for message in agent.on_messages_stream([TextMessage(content=task, source="user")], cancellation_token):
        if hasattr(message, 'content'):
            content = message.content if isinstance(message.content, str) else str(message.content)
            print(content, end="", flush=True)

    print("\n")


async def demo_model_context():
    """7. 使用模型上下文 - 多轮对话和历史记忆"""
    print("\n" + "=" * 60)
    print("演示7：使用模型上下文（多轮对话）")
    print("=" * 60)

    model_client = OpenAIChatCompletionClient(
        model="qwen2.5vl:3b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "family": "qwen"
        }
    )

    agent = AssistantAgent(
        name="context_agent",
        model_client=model_client,
        system_message="你是一个聊天助手，记住对话历史并提供连贯的回答。",
    )

    conversations = [
        "你好，我叫小明",
        "我今年25岁",
        "我喜欢编程，特别是Python",
        "你还记得我叫什么名字吗？我有什么爱好？"
    ]

    for i, task in enumerate(conversations, 1):
        print(f"\n第{i}轮对话：")
        print(f"用户：{task}")
        result = await agent.run(task=task)
        print(f"助手：{result.messages[-1].content}")


async def demo_get_result():
    """8. 获取结果 - 处理和解析响应"""
    print("\n" + "=" * 60)
    print("演示8：获取和处理结果")
    print("=" * 60)

    model_client = OpenAIChatCompletionClient(
        model="qwen2.5vl:3b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "family": "qwen"
        }
    )

    agent = AssistantAgent(
        name="result_agent",
        model_client=model_client,
        system_message="你是一个专业的技术顾问。",
    )

    task = "列出学习机器学习的三个步骤"
    result = await agent.run(task=task)

    print(f"任务：{task}\n")
    print(f"完整消息数：{len(result.messages)}")
    print(f"最后一条消息来源：{result.messages[-1].source}")
    print(f"\n最终回答：")
    print(result.messages[-1].content)

    # 遍历所有消息
    print("\n--- 完整对话历史 ---")
    for i, msg in enumerate(result.messages):
        print(f"[{i}] {msg.source}: {msg.content[:100]}..." if len(
            str(msg.content)) > 100 else f"[{i}] {msg.source}: {msg.content}")


# ==================== 主程序 ====================

async def main():
    """运行所有演示"""
    print("\n" + "#" * 60)
    print("# AutoGen 功能演示集合")
    print("#" * 60)

    demos = [
        # ("基本助手代理", demo_basic_assistant),
        # ("多模态输入", demo_multimodal_input),
        # ("流式消息", demo_streaming_messages),
        # ("使用工具", demo_with_tools),
        # ("结构化输出", demo_structured_output),
        ("流式传输令牌", demo_token_streaming),
        # ("模型上下文", demo_model_context),
        # ("获取结果", demo_get_result),
    ]

    for name, demo_func in demos:
        try:
            await demo_func()
        except Exception as e:
            print(f"演示 '{name}' 出错：{str(e)}\n")

    print("\n" + "=" * 60)
    print("所有演示完成！")
    print("=" * 60)


if __name__ == '__main__':
    # 运行单个演示（取消注释以运行特定演示）
    # asyncio.run(demo_basic_assistant())
    # asyncio.run(demo_multimodal_input())
    # asyncio.run(demo_streaming_messages())
    # asyncio.run(demo_with_tools())
    # asyncio.run(demo_structured_output())
    # asyncio.run(demo_token_streaming())
    # asyncio.run(demo_model_context())
    # asyncio.run(demo_get_result())

    # 运行所有演示
    asyncio.run(main())
