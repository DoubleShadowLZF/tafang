import asyncio
import logging

from autogen_agentchat.agents import AssistantAgent, UserProxyAgent
from autogen_agentchat.conditions import (
    TextMentionTermination,
)
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.ui import Console
from autogen_core import EVENT_LOGGER_NAME, CancellationToken
from autogen_ext.models.openai import OpenAIChatCompletionClient
from fastapi import WebSocket
from fastapi_cli.cli import app

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(EVENT_LOGGER_NAME)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


def create_model_client():
    """创建 Ollama 模型客户端"""
    return OpenAIChatCompletionClient(
        model="DeepSeek-R1-Distill-Qwen-7B-Q4_K_M",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
            "family": "deepseek",
            "structured_output": True
        }
    )


async def demo_create_poem():

    model_client = create_model_client()

    try:
        assistant = AssistantAgent("assistant", model_client=model_client)
        user_proxy = UserProxyAgent("user_proxy", input_func=input)  # Use input() to get user input from console.

        # Create the termination condition which will end the conversation when the user says "APPROVE".
        termination = TextMentionTermination("APPROVE")

        # Create the team.
        team = RoundRobinGroupChat([assistant, user_proxy], termination_condition=termination)

        # Run the conversation and stream to the console.
        stream = team.run_stream(task="Write a 4-line poem about the ocean.")
        # Use asyncio.run(...) when running in a script.
        await Console(stream)
        await model_client.close()
    finally:
        await model_client.close()


@app.websocket("/ws/chat")
async def chat(websocket: WebSocket):
    await websocket.accept()

    async def _user_input(prompt: str, cancellation_token: CancellationToken | None) -> str:
        data = await websocket.receive_json()  # Wait for user message from websocket.
        message = TextMessage.model_validate(data)  # Assume user message is a TextMessage.
        return message.content

    # Create user proxy with custom input function
    # Run the team with the user proxy
    # ...


if __name__ == '__main__':
    """
    RoundRobinGroupChat 完整演示

    包含以下功能：
    1. 在RoundRobinGroupChat使用中UserProxyAgent进行诗歌生成任务的示例
    """


    async def main():
        print("\n" + "=" * 80)
        print("🚀 AutoGen RoundRobinGroupChat 完整演示")
        print("=" * 80 + "\n")

        try:
            await demo_create_poem()

            print("=" * 80)
            print("✅ 所有演示完成！")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ 错误: {e}")
            import traceback
            traceback.print_exc()


    asyncio.run(main())

