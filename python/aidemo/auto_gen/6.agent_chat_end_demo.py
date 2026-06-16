import asyncio
import logging

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.conditions import (
    MaxMessageTermination,
)
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.ui import Console
from autogen_core import EVENT_LOGGER_NAME
from autogen_ext.models.openai import OpenAIChatCompletionClient

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




async def end_3_times():
    model_client = create_model_client()

    try:
        # Create the primary agent.
        primary_agent = AssistantAgent(
            "primary",
            model_client=model_client,
            system_message="You are a helpful AI assistant.",
        )

        # Create the critic agent.
        critic_agent = AssistantAgent(
            "critic",
            model_client=model_client,
            system_message="Provide constructive feedback for every message. Respond with 'APPROVE' to when your feedbacks are addressed.",
        )

        max_msg_termination = MaxMessageTermination(max_messages=3)
        round_robin_team = RoundRobinGroupChat([primary_agent, critic_agent], termination_condition=max_msg_termination)

        # Use asyncio.run(...) if you are running this script as a standalone script.
        await Console(round_robin_team.run_stream(task="Write a unique, Haiku about the weather in Paris"))

    finally:
        await model_client.close()



if __name__ == '__main__':
    """
    写一篇关于巴黎天气的独特俳句，运行三次后关闭
    """


    async def main():
        print("\n" + "=" * 80)
        print("🚀 AutoGen RoundRobinGroupChat 完整演示")
        print("=" * 80 + "\n")

        try:
            await end_3_times()

            print("=" * 80)
            print("✅ 所有演示完成！")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ 错误: {e}")
            import traceback
            traceback.print_exc()


    asyncio.run(main())

