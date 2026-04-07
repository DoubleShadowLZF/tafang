#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Qwen2.5 文本摘要器 - Transformers版本
需要安装: pip install torch transformers accelerate
"""

import os

os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM


class QwenSummarizerTransformers:
    """基于Transformers的文本摘要器"""

    def __init__(self, model_size="0.5b", use_gpu=True, max_length=2048):
        """
        初始化摘要器
        model_size: 模型大小
        use_gpu: 是否使用GPU
        max_length: 输入最大长度
        """
        self.max_length = max_length

        # 模型映射
        model_map = {
            "0.5b": "Qwen/Qwen2.5-0.5B-Instruct",
            "1.5b": "Qwen/Qwen2.5-1.5B-Instruct",
            "7b": "Qwen/Qwen2.5-7B-Instruct"
        }

        model_name = model_map.get(model_size, f"Qwen/Qwen2.5-{model_size}-Instruct")

        print(f"加载模型: {model_name}")

        # 加载tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            trust_remote_code=True
        )

        # 设置设备
        if use_gpu and torch.cuda.is_available():
            device_map = "auto"
            dtype = torch.float16
            print(f"使用GPU: {torch.cuda.get_device_name(0)}")
        else:
            device_map = "cpu"
            dtype = torch.float32
            print("使用CPU模式")

        # 加载模型
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            dtype=dtype,
            device_map=device_map,
            trust_remote_code=True,
            low_cpu_mem_usage=True
        )

        print("模型加载完成！")

    def summarize(self, text, max_new_tokens=256, temperature=0.3, style="concise"):
        """
        生成摘要

        text: 输入文本
        max_new_tokens: 摘要最大长度
        temperature: 创造性（0=保守，1=创意）
        style: 摘要风格
        """
        # 构建提示词
        prompts = {
            "concise": "请用简洁的语言总结以下内容：",
            "detailed": "请详细总结以下内容：",
            "bullet": "请用要点总结以下内容："
        }

        prompt = prompts.get(style, prompts["concise"])
        full_prompt = f"{prompt}\n\n{text}\n\n总结："

        # 编码输入
        inputs = self.tokenizer(
            full_prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_length
        )
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        # 生成摘要
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id
            )

        # 解码
        full_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # 提取摘要部分
        summary = full_output.split("总结：")[-1].strip()

        return summary

    def summarize_long_text(self, text, chunk_size=1500, overlap=200):
        """
        处理长文本的分块摘要

        text: 长文本
        chunk_size: 每块大小（字符数）
        overlap: 重叠大小
        """
        # 分块
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(text[start:end])
            start = end - overlap

        # 分别摘要
        summaries = []
        for i, chunk in enumerate(chunks):
            print(f"处理第 {i + 1}/{len(chunks)} 块...")
            summary = self.summarize(chunk, max_new_tokens=150)
            summaries.append(summary)

        # 合并摘要
        combined = " ".join(summaries)
        if len(combined) > self.max_length:
            final_summary = self.summarize(combined, max_new_tokens=300)
        else:
            final_summary = combined

        return final_summary


# 使用示例
if __name__ == "__main__":
    # 创建摘要器
    summarizer = QwenSummarizerTransformers("0.5b", use_gpu=False)

    # 测试文本
    text = """
    我家院子里，有一棵石榴树。在我还未出世的时候，它已经历了十一个春秋。每天放学回来，它总是面对着我，好像在说：“怎么样？今天还快乐吗？”看着它，每天的烦恼好像就烟消云散了。一年四季里，我们一家人对他悉心照料。
　　春天，石榴树上又抽出了细长的新枝，长出了翠绿翠绿的嫩叶。我想，该给石榴树脱下他的“棉衣”了，这天，正好是星期天，我跟堂弟争着要给石榴树脱棉衣。爸爸给我们出了一个好点子，堂弟个子小，它从底下开始解起，我个子高，从上面那头绳开始解起。解到最后一圈，我们俩都想解。结果，堂弟多转了一圈，又给绕上了，可把我们大家逗得捧腹大笑。
　　夏天，火红的石榴花开了，给茂盛的石榴树增添了无穷的魅力。从远处看，石榴花就像一个个可爱的小红喇叭挂在树上，惹人喜爱。我禁不住走上前去轻轻地摸了一下可爱的石榴花瓣，软软的`。我凑上去闻了闻，一阵阵清香扑鼻而来，让人如痴如醉。
　　秋天，淘气的石榴宝宝们个个都笑得裂开了嘴，压得树枝累弯了腰。该收了。我们进行了分工，爸爸负责摘石榴，我负责在左边接收，妈妈负责在右边接收。不到三十分钟，袋子里装满了石榴，我回到家里，挑一个裂了口的石榴一掰两半，只见密密麻麻的石榴粒挨挨挤挤但又井然有序地排列着，拿几颗放到嘴里，一种清凉的感觉，轻轻的一咬，噗的一声，溅出了酸甜的浆汁。我一边品尝着石榴，一边盘算送给亲戚朋友，让大家一同品尝我家的劳动果实。
　　冬天，寒风呼啸，我们准备给石榴树穿棉衣了。尽管天气很冷，我们还是兴致勃勃地拿上麻绳，我和爸爸一圈一圈的给石榴穿棉衣，妈妈给我和爸爸送热茶，来补充热量，石榴树已穿好了棉衣。我祝愿它明年能结出更多的果实。
　　我爱我家石榴树！
    """

    print("原文：")
    print(text)
    print("\n" + "=" * 50)

    # 生成简洁摘要
    print("\n【简洁摘要】")
    print(summarizer.summarize(text, style="concise", max_new_tokens=50))

    # 生成详细摘要
    print("\n【详细摘要】")
    print(summarizer.summarize(text, style="detailed", max_new_tokens=100))