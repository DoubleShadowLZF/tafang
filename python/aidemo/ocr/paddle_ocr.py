
# ... existing code ...
from paddleocr import PaddleOCR

# 全局只初始化一次
if 'ocr' not in globals():
    ocr = PaddleOCR(use_angle_cls=True, lang='ch')

def recognize_image(image_path):
    """识别图片中的文字"""
    # 使用新的 predict 方法替代已弃用的 ocr 方法
    result = ocr.predict(image_path)

    texts = []

    # 打印原始结果结构,方便调试
    print("原始结果类型:", type(result))
    print("原始结果:", result)
    print("="*50)

    # 根据实际返回格式解析
    if isinstance(result, list):
        for idx, line in enumerate(result):
            print(f"第 {idx} 个元素类型: {type(line)}")

            if line is None:
                continue

            # 如果 line 是字典
            if isinstance(line, dict):
                print(f"字典键: {line.keys()}")
                # 尝试从字典中提取文本信息
                if 'rec_texts' in line:
                    rec_texts = line['rec_texts']
                    rec_scores = line.get('rec_scores', [])

                    for i, text in enumerate(rec_texts):
                        confidence = rec_scores[i] if i < len(rec_scores) else 0
                        texts.append({
                            'text': text,
                            'confidence': confidence
                        })

            # 如果 line 是列表
            elif isinstance(line, list):
                print(f"列表长度: {len(line)}, 第一个元素: {line[0] if line else 'empty'}")

                for word_info in line:
                    try:
                        if isinstance(word_info, list) and len(word_info) >= 2:
                            bbox = word_info[0]
                            text_confidence = word_info[1]

                            if isinstance(text_confidence, tuple) and len(text_confidence) >= 2:
                                text = text_confidence[0]
                                confidence = text_confidence[1]

                                texts.append({
                                    'text': text,
                                    'confidence': confidence
                                })
                    except Exception as e:
                        print(f"处理出错: {e}, word_info: {word_info}")

    return texts

# 使用
results = recognize_image('../img/票据.png')
print("\n=== 识别结果 ===")
for item in results:
    print(f"识别文本: {item['text']}, 置信度: {item['confidence']:.2f}")