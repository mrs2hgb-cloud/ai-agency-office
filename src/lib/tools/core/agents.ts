import { ALL_AGENTS } from "@/components/virtual-office/data";
import type { AgentId } from "@/components/virtual-office/types";

/** Display name for logs people read (e.g. "מנהלת המשרד") */
export const agentName = (id: AgentId) => ALL_AGENTS.find((a) => a.id === id)?.name ?? id;
