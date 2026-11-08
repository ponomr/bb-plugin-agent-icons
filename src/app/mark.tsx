/**
 * With no usable assignment the mark draws the provider's own artwork through
 * a nested ProviderIcon, which bb resolves past this mark. The nested icon
 * needs the full provider record: an id-only record falls back to the Code
 * glyph on the phone app.
 */
import { Component, type ComponentType, type ReactElement, type ReactNode } from "react";
import {
  experimental_Icon as BbIcon,
  experimental_ProviderIcon as ProviderIcon,
} from "@get-bb/plugin-sdk/app";
import { isBuiltinIcon } from "../shared/builtin-icons";
import { iconRef, type Assignment, type IconsState } from "../shared/contract";
import { renderTree } from "./render-tree";
import { useIconsSnapshot, type ProviderRecord } from "./store";
import { tintColor } from "./tint";

interface MarkProps {
  className?: string;
}

class MarkBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function assignedArtwork(
  assignment: Assignment,
  state: Pick<IconsState, "icons">,
  className?: string,
): ReactElement | null {
  const color = tintColor(assignment.tint);
  const style = color ? { color } : undefined;
  const { source } = assignment;
  if ("builtin" in source) {
    if (!isBuiltinIcon(source.builtin)) return null;
    return <BbIcon name={source.builtin} fallback="CircleHelp" className={className} style={style} aria-hidden />;
  }
  const entry = state.icons[iconRef(source.set, source.icon)];
  return entry ? renderTree(entry.tree, { className, style, "aria-hidden": true }) : null;
}

export function OriginalIcon({ provider, className }: { provider: ProviderRecord | { id: string }; className?: string }) {
  return <ProviderIcon providerKind="agent" provider={provider} className={className} />;
}

export function createMark(providerId: string): ComponentType<MarkProps> {
  function AgentIconsMark({ className }: MarkProps) {
    const { state, providers } = useIconsSnapshot();
    const provider = providers.find((p) => p.id === providerId) ?? { id: providerId };
    const original = <OriginalIcon provider={provider} className={className} />;
    const assignment = state?.assignments[providerId];
    const artwork = state && assignment ? assignedArtwork(assignment, state, className) : null;
    if (!artwork) return original;
    return (
      <MarkBoundary key={JSON.stringify(assignment)} fallback={original}>
        {artwork}
      </MarkBoundary>
    );
  }
  AgentIconsMark.displayName = `AgentIconsMark(${providerId})`;
  return AgentIconsMark;
}
