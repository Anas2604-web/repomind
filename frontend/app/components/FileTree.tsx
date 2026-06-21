"use client";

import { useEffect, useRef, useState } from "react";

type TreeNode = { name: string; path: string; type: "file" | "dir"; children?: TreeNode[] };
export type TraceTarget = { path: string; key: number } | null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function FileTree({
                                     repoId,
                                     onFileClick,
                                     traceTarget,
                                 }: {
    repoId: string;
    onFileClick: (path: string) => void;
    traceTarget?: TraceTarget;
}) {
    const [tree, setTree] = useState<TreeNode | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`${API_URL}/repo/files/${repoId}`)
            .then((res) => res.json())
            .then((data) => setTree(data))
            .finally(() => setLoading(false));
    }, [repoId]);

    if (loading) return <div className="fadeIn" style={{ fontSize: 12, color: "var(--color-text-muted)", padding: 12 }}>Loading file tree...</div>;
    if (!tree) return null;

    return (
        <div className="fadeIn" style={{ fontSize: 13, overflowY: "auto", flex: 1, padding: "6px 0" }}>
            {tree.children?.map((child) => (
                <TreeRow key={child.path} node={child} depth={0} onFileClick={onFileClick} traceTarget={traceTarget} />
            ))}
        </div>
    );
}

function TreeRow({
                     node,
                     depth,
                     onFileClick,
                     traceTarget,
                 }: {
    node: TreeNode;
    depth: number;
    onFileClick: (path: string) => void;
    traceTarget?: TraceTarget;
}) {
    const isAncestorOfTrace = !!traceTarget && traceTarget.path.startsWith(node.path + "/");
    const [open, setOpen] = useState(depth === 0);
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isAncestorOfTrace) setOpen(true);
    }, [isAncestorOfTrace, traceTarget?.key]);

    const isLit = node.type === "file" && traceTarget?.path === node.path;

    useEffect(() => {
        if (isLit) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [isLit, traceTarget?.key]);

    if (node.type === "dir") {
        return (
            <div>
                <div
                    onClick={() => setOpen(!open)}
                    style={{
                        padding: "4px 8px",
                        paddingLeft: 10 + depth * 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--color-text-muted)",
                        borderRadius: 4,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-raised)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                    <span style={{ fontSize: 10, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
                    <span>{node.name}</span>
                </div>
                {open && node.children?.map((child) => (
                    <TreeRow key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} traceTarget={traceTarget} />
                ))}
            </div>
        );
    }

    return (
        <div
            key={isLit ? `lit-${traceTarget?.key}` : node.path}
            ref={rowRef}
            onClick={() => onFileClick(node.path)}
            className={isLit ? "tracePulse" : undefined}
            style={{
                padding: "4px 8px",
                paddingLeft: 24 + depth * 14,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                borderRadius: 4,
                color: "var(--color-text)",
            }}
            onMouseEnter={(e) => { if (!isLit) e.currentTarget.style.background = "var(--color-surface-raised)"; }}
            onMouseLeave={(e) => { if (!isLit) e.currentTarget.style.background = "transparent"; }}
        >
            {node.name}
        </div>
    );
}