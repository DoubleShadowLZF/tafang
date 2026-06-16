import asyncio
import json
import logging
from pathlib import Path

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_core import EVENT_LOGGER_NAME, CancellationToken
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


async def demo_save_load_agent():
    """演示 1: 保存和加载智能体状态"""
    print("=" * 80)
    print("💾 演示 1: 保存和加载智能体状态")
    print("=" * 80)

    model_client = create_model_client()

    try:
        # 创建智能体并进行对话
        assistant_agent = AssistantAgent(
            name="assistant_agent",
            system_message="You are a helpful assistant",
            model_client=model_client,
        )

        print("\n📝 第一轮对话：写一首关于坦噶尼喀湖的诗")
        response = await assistant_agent.on_messages(
            [TextMessage(content="Write a 3 line poem on lake tangayika", source="user")],
            CancellationToken()
        )
        print(f"回答: {response.chat_message.content}\n")

        # 保存状态
        print("💾 保存智能体状态...")
        agent_state = await assistant_agent.save_state()
        print(f"状态类型: {type(agent_state)}")
        print(f"状态键数量: {len(agent_state)}\n")

        # 创建新的智能体并加载状态
        print("📂 创建新智能体并加载状态...")
        new_assistant_agent = AssistantAgent(
            name="assistant_agent",
            system_message="You are a helpful assistant",
            model_client=model_client,
        )
        await new_assistant_agent.load_state(agent_state)

        # 继续对话，测试状态是否恢复
        print("\n📝 第二轮对话：询问上一首诗的最后一行")
        response = await new_assistant_agent.on_messages(
            [TextMessage(content="What was the last line of the previous poem you wrote", source="user")],
            CancellationToken()
        )
        print(f"回答: {response.chat_message.content}\n")

    finally:
        await model_client.close()


async def demo_save_load_team():
    """演示 2: 保存和加载团队状态"""
    print("=" * 80)
    print("💾 演示 2: 保存和加载团队状态")
    print("=" * 80)

    model_client = create_model_client()

    try:
        # 创建智能体
        agent1 = AssistantAgent(
            name="writer",
            system_message="You are a creative writer.",
            model_client=model_client,
        )

        agent2 = AssistantAgent(
            name="editor",
            system_message="You are an editor. Review and say 'DONE' when finished.",
            model_client=model_client,
        )

        # 创建团队
        termination = MaxMessageTermination(max_messages=4)
        team = RoundRobinGroupChat(
            participants=[agent1, agent2],
            termination_condition=termination,
        )

        print("\n📝 第一轮团队对话：讨论人工智能")
        result1 = await team.run(task="Discuss the impact of AI on society")
        print(f"消息数: {len(result1.messages)}")
        print(f"停止原因: {result1.stop_reason}\n")

        # 保存团队状态
        print("💾 保存团队状态...")
        team_state = await team.save_state()
        print(f"状态类型: {type(team_state)}")
        print(f"状态键数量: {len(team_state)}\n")

        # 创建新团队并加载状态
        print("📂 创建新团队并加载状态...")
        new_agent1 = AssistantAgent(
            name="writer",
            system_message="You are a creative writer.",
            model_client=model_client,
        )
        new_agent2 = AssistantAgent(
            name="editor",
            system_message="You are an editor. Review and say 'DONE' when finished.",
            model_client=model_client,
        )

        new_team = RoundRobinGroupChat(
            participants=[new_agent1, new_agent2],
            termination_condition=termination,
        )
        await new_team.load_state(team_state)

        # 继续对话
        print("\n📝 第二轮团队对话：继续讨论")
        result2 = await new_team.run(task="Continue the discussion")
        print(f"消息数: {len(result2.messages)}")
        print(f"停止原因: {result2.stop_reason}\n")

    finally:
        await model_client.close()


async def demo_persist_to_file():
    """演示 3: 持久化状态到文件"""
    print("=" * 80)
    print("💾 演示 3: 持久化状态到文件")
    print("=" * 80)

    model_client = create_model_client()
    state_file = Path("agent_state.json")

    try:
        # 创建智能体并进行对话
        assistant_agent = AssistantAgent(
            name="assistant_agent",
            system_message="You are a helpful assistant",
            model_client=model_client,
        )

        print("\n📝 进行对话...")
        response = await assistant_agent.on_messages(
            [TextMessage(content="Tell me a fun fact about space", source="user")],
            CancellationToken()
        )
        print(f"回答: {response.chat_message.content}\n")

        # 保存状态到文件
        print("💾 保存状态到文件...")
        agent_state = await assistant_agent.save_state()

        # 将状态序列化为 JSON 并保存到文件
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(agent_state, f, ensure_ascii=False, indent=2)
        print(f"状态已保存到: {state_file.absolute()}\n")

        # 从文件加载状态
        print("📂 从文件加载状态...")
        with open(state_file, 'r', encoding='utf-8') as f:
            loaded_state = json.load(f)

        # 创建新智能体并加载状态
        new_assistant_agent = AssistantAgent(
            name="assistant_agent",
            system_message="You are a helpful assistant",
            model_client=model_client,
        )
        await new_assistant_agent.load_state(loaded_state)

        # 验证状态是否恢复
        print("\n📝 继续对话，测试状态恢复...")
        response = await new_assistant_agent.on_messages(
            [TextMessage(content="What did we just talk about?", source="user")],
            CancellationToken()
        )
        print(f"回答: {response.chat_message.content}\n")

        # 清理文件
        if state_file.exists():
            state_file.unlink()
            print(f"🗑️  已清理临时文件: {state_file}\n")

    finally:
        await model_client.close()


async def demo_persist_team_to_file():
    """演示 4: 持久化团队状态到文件"""
    print("=" * 80)
    print("💾 演示 4: 持久化团队状态到文件")
    print("=" * 80)

    model_client = create_model_client()
    team_state_file = Path("team_state.json")

    try:
        # 创建团队
        agent1 = AssistantAgent(
            name="planner",
            system_message="You are a planner. Create step-by-step plans.",
            model_client=model_client,
        )

        agent2 = AssistantAgent(
            name="executor",
            system_message="You are an executor. Follow the plan.",
            model_client=model_client,
        )

        termination = MaxMessageTermination(max_messages=3)
        team = RoundRobinGroupChat(
            participants=[agent1, agent2],
            termination_condition=termination,
        )

        print("\n📝 团队对话：制定旅行计划")
        result = await team.run(task="Plan a 3-day trip to Tokyo")
        print(f"消息数: {len(result.messages)}\n")

        # 保存团队状态到文件
        print("💾 保存团队状态到文件...")
        team_state = await team.save_state()

        with open(team_state_file, 'w', encoding='utf-8') as f:
            json.dump(team_state, f, ensure_ascii=False, indent=2)
        print(f"状态已保存到: {team_state_file.absolute()}\n")

        # 从文件加载状态
        print("📂 从文件加载团队状态...")
        with open(team_state_file, 'r', encoding='utf-8') as f:
            loaded_team_state = json.load(f)

        # 创建新团队并加载状态
        new_agent1 = AssistantAgent(
            name="planner",
            system_message="You are a planner. Create step-by-step plans.",
            model_client=model_client,
        )
        new_agent2 = AssistantAgent(
            name="executor",
            system_message="You are an executor. Follow the plan.",
            model_client=model_client,
        )

        new_team = RoundRobinGroupChat(
            participants=[new_agent1, new_agent2],
            termination_condition=termination,
        )
        await new_team.load_state(loaded_team_state)

        print("✅ 团队状态已成功加载\n")

        # 清理文件
        if team_state_file.exists():
            team_state_file.unlink()
            print(f"🗑️  已清理临时文件: {team_state_file}\n")

    finally:
        await model_client.close()


if __name__ == '__main__':
    """
    AutoGen 状态管理完整演示

    包含以下功能：
    1. 保存和加载智能体状态
    2. 保存和加载团队状态
    3. 持久化智能体状态到文件
    4. 持久化团队状态到文件
    """


    async def main():
        print("\n" + "=" * 80)
        print("🚀 AutoGen 状态管理完整演示")
        print("=" * 80 + "\n")

        try:
            # 1. 保存和加载智能体
            await demo_save_load_agent()

            # 2. 保存和加载团队
            await demo_save_load_team()

            # 3. 持久化智能体到文件
            await demo_persist_to_file()

            # 4. 持久化团队到文件
            await demo_persist_team_to_file()

            print("=" * 80)
            print("✅ 所有演示完成！")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ 错误: {e}")
            import traceback
            traceback.print_exc()


    asyncio.run(main())

