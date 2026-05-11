from ai.rag_agent import RAGAgent


def test_task06_history_context_respects_budget():
    agent = RAGAgent("00000000-0000-0000-0000-000000000001")
    history = [
        {"role": "user", "content": "A" * 300},
        {"role": "assistant", "content": "B" * 300},
        {"role": "user", "content": "C" * 300},
        {"role": "assistant", "content": "D" * 300},
    ]
    text, used = agent._build_history_context(history, max_turns=4, char_budget=500)
    assert used <= 500
    assert len(text) <= 500
    assert text


def test_task06_detect_locale_vi_and_en():
    agent = RAGAgent("00000000-0000-0000-0000-000000000001")
    assert agent._detect_locale("Xin chào, báo giá gói này", []) == "vi"
    assert agent._detect_locale("Show me latest order status", []) == "en"
