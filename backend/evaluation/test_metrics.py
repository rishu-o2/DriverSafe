import unittest

from evaluation.metrics import classification_metrics, pr_auc, roc_auc


class MetricsTest(unittest.TestCase):
    def test_known_confusion_and_frame_metrics(self):
        result = classification_metrics(
            [1, 1, 0, 0], [1, 0, 1, 0], [0.9, 0.4, 0.8, 0.1]
        )
        self.assertEqual(result["confusion"], {"tp": 1, "fp": 1, "fn": 1, "tn": 1})
        self.assertEqual(result["precision"], 0.5)
        self.assertEqual(result["recall"], 0.5)
        self.assertEqual(result["f1"], 0.5)
        self.assertEqual(result["roc_auc"], 0.75)
        self.assertAlmostEqual(result["pr_auc"], 19 / 24)

    def test_auc_is_undefined_for_one_class(self):
        self.assertIsNone(roc_auc([1, 1], [0.1, 0.2]))
        self.assertIsNone(pr_auc([0, 0], [0.1, 0.2]))

    def test_invalid_lengths_are_rejected(self):
        with self.assertRaises(ValueError):
            classification_metrics([1], [1, 0])


if __name__ == "__main__":
    unittest.main()
