import logging
import asyncio

from autogen_core import EVENT_LOGGER_NAME
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core.models import UserMessage

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(EVENT_LOGGER_NAME)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


async def main():
    """主函数：演示使用 Ollama 本地模型进行对话"""

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

    try:
        result = await model_client.create(
            [UserMessage(content="What is the capital of France?", source="user")]
        )
        print("响应结果:")
        print(result)

        if hasattr(result, 'content'):
            print(f"\n提取内容: {result.content}")

    except Exception as e:
        logger.error(f"调用模型时出错: {e}")
        raise

    finally:
        await model_client.close()


if __name__ == "__main__":
    asyncio.run(main())
