# 1. 导入所需库
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# 2. 加载模型和分词器（第一次运行时会自动下载，约1GB，请耐心等待）
model_name = "Qwen/Qwen2.5-0.5B-Instruct"
print("🤖 正在加载模型，首次运行需要下载，请稍候...")
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,  # 使用半精度，减少内存占用
    device_map="auto",  # 自动选择CPU或GPU
    trust_remote_code=True
)
print("✅ 模型加载成功！")


# 3. 定义一个客服对话函数
def chat_with_ai(user_input):
    """
    处理用户输入并生成AI回复
    """
    # 使用官方推荐的聊天模板，把它包装成“客服”角色
    # [citation:3][citation:8] 建议通过修改System Prompt来定制客服风格
    messages = [
        {"role": "system", "content": "你是一个专业、热情的电商客服助手，名叫小Q。你的回复要简洁、友好、有帮助。"},
        {"role": "user", "content": user_input}
    ]

    # 将对话模板转换为模型能理解的token
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

    # 模型开始生成回复
    generated_ids = model.generate(
        **model_inputs,
        max_new_tokens=512,  # 限制回复的最大长度
        do_sample=True,  # 开启采样，让回复更多样
        temperature=0.7,  # 控制随机性，越小越确定
    )

    # 将模型输出的token解码回我们能读懂的文本
    generated_ids = [
        output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
    ]
    response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return response


# 4. 启动一个简单的命令行交互界面
print("\n" + "=" * 50)
print("💬 智能客服已启动！输入 'exit' 结束对话。")
print("=" * 50)

while True:
    user_input = input("\n🧑 我: ")
    if user_input.lower() == 'exit':
        print("🤖 客服: 感谢您的咨询，祝您生活愉快！")
        break
    if not user_input:
        continue

    response = chat_with_ai(user_input)
    print(f"🤖 客服: {response}")