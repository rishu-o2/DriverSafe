"""Small, dependency-free binary classification metrics."""


def _validate_lengths(labels, predictions, scores=None):
    if len(labels) != len(predictions) or (scores is not None and len(labels) != len(scores)):
        raise ValueError("labels, predictions, and scores must have matching lengths")


def roc_auc(labels, scores):
    _validate_lengths(labels, [None] * len(labels), scores)
    positives = sum(bool(label) for label in labels)
    negatives = len(labels) - positives
    if not positives or not negatives:
        return None

    ranked = sorted((float(score), bool(label)) for label, score in zip(labels, scores))
    positive_rank_sum = 0.0
    index = 0
    while index < len(ranked):
        end = index + 1
        while end < len(ranked) and ranked[end][0] == ranked[index][0]:
            end += 1
        average_rank = ((index + 1) + end) / 2.0
        positive_rank_sum += average_rank * sum(label for _, label in ranked[index:end])
        index = end
    return (positive_rank_sum - positives * (positives + 1) / 2.0) / (positives * negatives)


def pr_auc(labels, scores):
    _validate_lengths(labels, [None] * len(labels), scores)
    positives = sum(bool(label) for label in labels)
    if not positives or positives == len(labels):
        return None

    ranked = sorted(((float(score), bool(label)) for label, score in zip(labels, scores)), reverse=True)
    points = [(0.0, 1.0)]
    true_positives = false_positives = 0
    index = 0
    while index < len(ranked):
        end = index + 1
        while end < len(ranked) and ranked[end][0] == ranked[index][0]:
            end += 1
        group = ranked[index:end]
        true_positives += sum(label for _, label in group)
        false_positives += len(group) - sum(label for _, label in group)
        recall = true_positives / positives
        precision = true_positives / (true_positives + false_positives)
        points.append((recall, precision))
        index = end

    return sum(
        (right[0] - left[0]) * (right[1] + left[1]) / 2.0
        for left, right in zip(points, points[1:])
    )


def classification_metrics(labels, predictions, scores=None):
    _validate_lengths(labels, predictions, scores)
    labels = [bool(value) for value in labels]
    predictions = [bool(value) for value in predictions]
    tp = sum(actual and predicted for actual, predicted in zip(labels, predictions))
    fp = sum(not actual and predicted for actual, predicted in zip(labels, predictions))
    fn = sum(actual and not predicted for actual, predicted in zip(labels, predictions))
    tn = sum(not actual and not predicted for actual, predicted in zip(labels, predictions))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "frames": len(labels),
        "positive_frames": sum(labels),
        "negative_frames": len(labels) - sum(labels),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "roc_auc": roc_auc(labels, scores) if scores is not None else None,
        "pr_auc": pr_auc(labels, scores) if scores is not None else None,
    }
