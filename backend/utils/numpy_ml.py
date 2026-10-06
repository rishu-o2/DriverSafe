"""Small NumPy-only equivalents for the runtime clustering algorithms."""

from __future__ import annotations

import numpy as np


def pairwise_squared_distances(a: np.ndarray, b: np.ndarray | None = None) -> np.ndarray:
    a = np.asarray(a, dtype=np.float64)
    b = a if b is None else np.asarray(b, dtype=np.float64)
    distances = np.sum(a * a, axis=1)[:, None] + np.sum(b * b, axis=1)[None, :] - 2 * (a @ b.T)
    return np.maximum(distances, 0.0)


def standardize(values: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    return (np.asarray(values, dtype=np.float64) - mean) / scale


def pca_transform(values: np.ndarray, mean: np.ndarray, components: np.ndarray) -> np.ndarray:
    return (np.asarray(values, dtype=np.float64) - mean) @ components.T


def kmeans_predict(values: np.ndarray, centers: np.ndarray) -> np.ndarray:
    return np.argmin(pairwise_squared_distances(values, centers), axis=1)


def kmeans_fit(values: np.ndarray, k: int, seed: int = 42, n_init: int = 5, max_iter: int = 100):
    x = np.asarray(values, dtype=np.float64)
    if len(x) == 0:
        return np.empty((0, x.shape[1])), np.empty(0, dtype=int), 0.0
    k = min(max(1, int(k)), len(x))
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(max(1, n_init)):
        centers = [x[int(rng.integers(len(x)))]]
        closest = pairwise_squared_distances(x, np.asarray(centers)).ravel()
        while len(centers) < k:
            total = float(closest.sum())
            index = int(rng.choice(len(x), p=closest / total)) if total > 0 else int(rng.integers(len(x)))
            centers.append(x[index])
            closest = np.minimum(closest, pairwise_squared_distances(x, x[index:index + 1]).ravel())
        centers = np.asarray(centers).copy()
        labels = np.zeros(len(x), dtype=int)
        for _iteration in range(max_iter):
            labels = kmeans_predict(x, centers)
            updated = centers.copy()
            for cluster in range(k):
                members = x[labels == cluster]
                if len(members):
                    updated[cluster] = members.mean(axis=0)
                else:
                    updated[cluster] = x[int(rng.integers(len(x)))]
            if np.allclose(updated, centers, rtol=1e-6, atol=1e-8):
                centers = updated
                break
            centers = updated
        labels = kmeans_predict(x, centers)
        inertia = float(np.sum((x - centers[labels]) ** 2))
        if best is None or inertia < best[2]:
            best = centers, labels, inertia
    return best


def dbscan(values: np.ndarray, eps: float = 0.8, min_samples: int = 10) -> np.ndarray:
    x = np.asarray(values, dtype=np.float64)
    if len(x) == 0:
        return np.empty(0, dtype=int)
    neighbors = pairwise_squared_distances(x) <= eps * eps
    core = neighbors.sum(axis=1) >= min_samples
    labels = np.full(len(x), -2, dtype=int)  # unvisited
    cluster = 0
    for point in range(len(x)):
        if labels[point] != -2:
            continue
        if not core[point]:
            labels[point] = -1
            continue
        labels[point] = cluster
        queue = list(np.flatnonzero(neighbors[point]))
        seen = set(queue)
        cursor = 0
        while cursor < len(queue):
            candidate = queue[cursor]
            cursor += 1
            if labels[candidate] == -1:
                labels[candidate] = cluster
            if labels[candidate] != -2:
                continue
            labels[candidate] = cluster
            if core[candidate]:
                for neighbor in np.flatnonzero(neighbors[candidate]):
                    neighbor = int(neighbor)
                    if neighbor not in seen:
                        seen.add(neighbor)
                        queue.append(neighbor)
        cluster += 1
    return labels


def silhouette_score(values: np.ndarray, labels: np.ndarray) -> float:
    x = np.asarray(values, dtype=np.float64)
    labels = np.asarray(labels)
    groups = np.unique(labels)
    if len(groups) < 2 or len(groups) >= len(x):
        return 0.0
    distances = np.sqrt(pairwise_squared_distances(x))
    scores = []
    for i, label in enumerate(labels):
        own = labels == label
        own_count = int(own.sum())
        a = float(distances[i, own].sum() / (own_count - 1)) if own_count > 1 else 0.0
        b = min(float(distances[i, labels == other].mean()) for other in groups if other != label)
        scores.append((b - a) / max(a, b) if max(a, b) else 0.0)
    return float(np.mean(scores))


def davies_bouldin_score(values: np.ndarray, labels: np.ndarray) -> float:
    x = np.asarray(values, dtype=np.float64)
    labels = np.asarray(labels)
    groups = np.unique(labels)
    if len(groups) < 2:
        return 0.0
    centers = np.asarray([x[labels == label].mean(axis=0) for label in groups])
    scatters = np.asarray([np.linalg.norm(x[labels == label] - centers[i], axis=1).mean() for i, label in enumerate(groups)])
    center_distances = np.sqrt(pairwise_squared_distances(centers))
    np.fill_diagonal(center_distances, np.inf)
    ratios = (scatters[:, None] + scatters[None, :]) / np.maximum(center_distances, 1e-12)
    return float(np.mean(np.max(ratios, axis=1)))


def agglomerative_ward(values: np.ndarray, n_clusters: int = 3) -> np.ndarray:
    x = np.asarray(values, dtype=np.float64)
    n = len(x)
    if n <= n_clusters:
        return np.arange(n, dtype=int)
    n_clusters = max(1, min(int(n_clusters), n))
    sizes = np.ones(n, dtype=np.float64)
    distances = pairwise_squared_distances(x)
    costs = np.outer(sizes, sizes) / (sizes[:, None] + sizes[None, :]) * distances
    np.fill_diagonal(costs, np.inf)
    active = np.ones(n, dtype=bool)
    groups = [[i] for i in range(n)]
    remaining = n
    while remaining > n_clusters:
        indices = np.flatnonzero(active)
        active_costs = costs[np.ix_(indices, indices)]
        pos = np.unravel_index(np.argmin(active_costs), active_costs.shape)
        a, b = int(indices[pos[0]]), int(indices[pos[1]])
        if a > b:
            a, b = b, a
        na, nb = sizes[a], sizes[b]
        others = indices[(indices != a) & (indices != b)]
        updated = ((na + sizes[others]) * costs[a, others] + (nb + sizes[others]) * costs[b, others] - sizes[others] * costs[a, b]) / (na + nb + sizes[others])
        costs[a, others] = updated
        costs[others, a] = updated
        costs[a, a] = np.inf
        active[b] = False
        costs[b, :] = np.inf
        costs[:, b] = np.inf
        groups[a].extend(groups[b])
        groups[b] = []
        sizes[a] = na + nb
        remaining -= 1
    labels = np.empty(n, dtype=int)
    for label, index in enumerate(np.flatnonzero(active)):
        labels[groups[index]] = label
    return labels
