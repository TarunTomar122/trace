import json
import types
import unittest

from v3.lib.decisions import decide


class FakeCompletions:
    def __init__(self, payload: dict):
        self.payload = payload
        self.request: dict = {}

    def create(self, **kwargs):
        self.request = kwargs
        message = types.SimpleNamespace(content=json.dumps(self.payload))
        return types.SimpleNamespace(choices=[types.SimpleNamespace(message=message)])


def fake_client(payload: dict):
    completions = FakeCompletions(payload)
    return types.SimpleNamespace(chat=types.SimpleNamespace(completions=completions)), completions


QUESTIONS = {
    "t0_importance": {"type": "score", "instructions": "How important?", "criteria": ["low", "mid", "high"]},
    "p0_relationship": {"type": "choice", "instructions": "Relation?", "criteria": {"same": "x", "other": "y"}},
    "p0_same_card": {"type": "noul", "instructions": "One card?", "criteria": {"true": "a", "false": "b"}},
}


class DecisionTests(unittest.TestCase):
    def test_answers_map_to_the_pipeline_shape(self):
        client, completions = fake_client({
            "t0_importance": {"score": 2, "confidence": 1.4},
            "p0_relationship": {"choice": "same"},
            "p0_same_card": {"probability": 0.8},
        })
        answers = decide({"topics": {"t0": {"title": "X"}}}, QUESTIONS, client=client)["answers"]
        self.assertEqual(answers["t0_importance"], {"score": 2, "confidence": 1.0})  # clamped
        self.assertEqual(answers["p0_relationship"], {"choice": "same"})
        self.assertEqual(answers["p0_same_card"], {"noul": 0.8})

    def test_strict_schema_constrains_every_answer(self):
        client, completions = fake_client({})
        decide({"topics": {}}, QUESTIONS, client=client)
        schema = completions.request["response_format"]["json_schema"]
        self.assertTrue(schema["strict"])
        props = schema["schema"]["properties"]
        self.assertEqual(props["t0_importance"]["properties"]["score"]["enum"], [0, 1, 2])
        self.assertEqual(props["p0_relationship"]["properties"]["choice"]["enum"], ["same", "other"])
        self.assertEqual(sorted(schema["schema"]["required"]), sorted(QUESTIONS))
        # Article text goes in as data, after the questions.
        self.assertIn('"STATE"', completions.request["messages"][1]["content"])


if __name__ == "__main__":
    unittest.main()
