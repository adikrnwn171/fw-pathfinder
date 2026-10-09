"""
graph.py — Builds a directed graph from topologi_map.json and precomputes
all-pairs shortest paths using BFS.

Graph model:
  Node  = (fw_name, vsys_name)
  Edge  = (src_node, src_gate, dst_node, dst_gate)
    src_node exits via src_gate
    dst_node enters via dst_gate

Connections are BIDIRECTIONAL: A.gate1-->B.gate2 also implies B.gate2-->A.gate1.

HopDetail stores per-NODE entry/exit gates:
  entry_gate = dst_gate of the incoming edge  (how traffic ARRIVES)
  exit_gate  = src_gate of the outgoing edge  (how traffic LEAVES)

"other/unconfigured" nodes are kept for traversal but skipped in output.
"""

import json
from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

Node = Tuple[str, str]   # (fw_name, vsys_name)


@dataclass
class Edge:
    src_node : Node
    src_gate : str    # exit gate of src_node
    dst_node : Node
    dst_gate : str    # entry gate of dst_node


@dataclass
class HopDetail:
    """One hop = one firewall rule row in the output."""
    firewall   : str
    vsys       : str
    entry_gate : str   # Src Zone column  — how traffic arrives at this node
    exit_gate  : str   # Dst Zone column  — how traffic leaves this node
    is_other   : bool  # True for other/unconfigured — skip in output


class TopologyGraph:

    OTHER_FW   = "other"
    OTHER_VSYS = "unconfigured"

    def __init__(self):
        self._adj        : Dict[Node, List[Edge]] = {}
        self._meta       : Dict[Node, dict]       = {}
        self._zone_to_node: Dict[str, Node]       = {}
        self._path_cache : Dict[Tuple[Node,Node], Optional[List[HopDetail]]] = {}
        self._loaded = False

    # ── Loading ───────────────────────────────────────────────────────────────

    def load(self, path: str) -> None:
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)

        for fw, vsys_dict in data["physicals"].items():
            for vsys, detail in vsys_dict.items():
                node = (fw, vsys)
                self._adj[node]  = []
                self._meta[node] = {
                    "gates": detail.get("gates", []),
                    "zones": detail.get("zones", []),
                }
                for zone in detail.get("zones", []):
                    self._zone_to_node[zone.strip()] = node

        for conn in data["connections"]:
            src_fw, src_vsys, src_gate = self._parse_endpoint(conn[0])
            dst_fw, dst_vsys, dst_gate = self._parse_endpoint(conn[1])
            src_node = (src_fw, src_vsys)
            dst_node = (dst_fw, dst_vsys)

            for n in (src_node, dst_node):
                if n not in self._adj:
                    self._adj[n]  = []
                    self._meta[n] = {"gates": [], "zones": []}

            fwd = Edge(src_node, src_gate, dst_node, dst_gate)
            rev = Edge(dst_node, dst_gate, src_node, src_gate)  # bidirectional
            self._adj[src_node].append(fwd)
            self._adj[dst_node].append(rev)

        self._loaded = True
        n_edges = sum(len(v) for v in self._adj.values())
        print(f"[graph] Loaded {len(self._adj)} nodes, "
              f"{n_edges} directed edges ({n_edges // 2} bidirectional pairs)")

    # ── Precompute all-pairs BFS ───────────────────────────────────────────────

    def precompute_paths(self) -> None:
        for src in list(self._adj.keys()):
            self._bfs_from(src)
        print(f"[graph] Precomputed {len(self._path_cache)} node-pair paths.")

    def _bfs_from(self, src: Node) -> None:
        # prev[node] = incoming Edge used to reach it
        prev: Dict[Node, Optional[Edge]] = {src: None}
        queue = deque([src])
        while queue:
            current = queue.popleft()
            for edge in self._adj.get(current, []):
                if edge.dst_node not in prev:
                    prev[edge.dst_node] = edge
                    queue.append(edge.dst_node)

        for dst in prev:
            if dst == src:
                self._path_cache[(src, dst)] = []
            else:
                self._path_cache[(src, dst)] = self._reconstruct(prev, src, dst)

    def _reconstruct(self, prev: Dict, src: Node, dst: Node) -> List[HopDetail]:
        """
        Walk prev map backward from dst to src.
        Build ordered list of HopDetail — one per node in the path.

        For each node in the path:
          entry_gate = dst_gate of the edge that brought traffic INTO this node
          exit_gate  = src_gate of the edge that sends traffic OUT of this node

        First node (src): entry = segment zone (filled by resolver), exit = src_gate of first edge
        Last node  (dst): entry = dst_gate of last edge,            exit = segment zone (filled by resolver)
        Middle nodes    : entry = dst_gate of incoming edge,        exit = src_gate of outgoing edge
        """
        # Collect edges from src→dst in order
        edges: List[Edge] = []
        node = dst
        while node != src:
            edge = prev[node]
            edges.append(edge)
            node = edge.src_node
        edges.reverse()   # now src→dst order

        # Node sequence: src_node of edges[0], then dst_node of each edge
        nodes: List[Node] = [edges[0].src_node] + [e.dst_node for e in edges]

        hops: List[HopDetail] = []
        for i, node in enumerate(nodes):
            fw, vsys = node
            is_first = (i == 0)
            is_last  = (i == len(nodes) - 1)

            # entry_gate: segment zone placeholder for first node (resolver fills it)
            #             dst_gate of the edge that arrived at this node for all others
            entry_gate = "__SRC_ZONE__" if is_first else edges[i - 1].dst_gate

            # exit_gate: src_gate of the edge leaving this node for all but last
            #            segment zone placeholder for last node (resolver fills it)
            exit_gate = edges[i].src_gate if not is_last else "__DST_ZONE__"

            hops.append(HopDetail(
                firewall   = fw,
                vsys       = vsys,
                entry_gate = entry_gate,
                exit_gate  = exit_gate,
                is_other   = (fw == self.OTHER_FW),
            ))

        return hops

    # ── Public path lookup ────────────────────────────────────────────────────

    def get_path(self, src_node: Node, dst_node: Node) -> Optional[List[HopDetail]]:
        if not self._loaded:
            raise RuntimeError("Graph not loaded. Call load() first.")
        if src_node == dst_node:
            return []
        raw = self._path_cache.get((src_node, dst_node))
        if raw is None:
            return None
        # Filter other/unconfigured transit nodes from output
        return [h for h in raw if not h.is_other]

    def node_for_zone(self, zone: str) -> Optional[Node]:
        return self._zone_to_node.get(zone.strip())

    def all_nodes(self) -> List[Node]:
        return list(self._adj.keys())

    @staticmethod
    def _parse_endpoint(s: str) -> Tuple[str, str, str]:
        parts = s.split(".", 2)
        if len(parts) != 3:
            raise ValueError(f"Cannot parse topology endpoint: '{s}'")
        return parts[0], parts[1], parts[2]
