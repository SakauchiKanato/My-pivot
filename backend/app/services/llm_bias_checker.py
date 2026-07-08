import os
from google import genai
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

# Geminiに返してほしいデータの形（バイアスの有無と、問い返しの言葉）
class BiasCheckResult(BaseModel):
    has_bias: bool
    question_to_user: str

def check_outcome_bias(title: str, content: str, confidence: int, flag: str, reason_judgment: str) -> BiasCheckResult:
    """
    ユーザーが結果を綴じる際の理由（reason_judgment）に、アウトカムバイアスが含まれていないか判定する。
    """
    prompt = f"""
あなたはユーザーの意思決定を客観的に振り返るためのAIコーチです。
ユーザーは過去に悩みを記録し、今その結果を振り返って理由を書いています。

【決定時の記録（当時は結果を知りません）】
- 悩み: {title}
- 詳細: {content}
- 当時の成功見込み(1-5): {confidence}

【今回の振り返り（結果を知った上で書いています）】
- 最終的な結果: {flag}
- 振り返りの理由: {reason_judgment}

タスク:
「振り返りの理由」の中に、結果を知っているからこそ言える「後知恵」や「結果論（アウトカムバイアス）」が含まれていないか判定してください。

- もし含まれている場合（has_bias = true）:
  当時の視点に引き戻すような優しい問いかけ（question_to_user）を1つだけ生成してください。
- もし含まれていない場合、あるいは素晴らしい言語化ができている場合（has_bias = false）:
  「素晴らしい振り返りですね。当時の状況がクリアに伝わります。」のような、ユーザーの言語化を肯定し称賛する一言を question_to_user に生成してください。
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': BiasCheckResult,
                'temperature': 0.2, # 少しだけ創造性を持たせる
            },
        )
        return response.parsed
    except Exception as e:
        print(f"Bias check error: {e}")
        # エラー時はバイアスなしとして処理を通す
        return BiasCheckResult(has_bias=False, question_to_user="")
