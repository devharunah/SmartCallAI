"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Agent } from "@/lib/types";

export function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents");
    const data: Agent[] = await res.json();
    setAgents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAvailability = useCallback(async (agent: Agent) => {
    const next = !agent.available;
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, available: next } : a))
    );

    const res = await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: next }),
    });

    if (!res.ok) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, available: agent.available } : a))
      );
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <h1 className="text-xl font-semibold">Agents</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No agents found.
                  </TableCell>
                </TableRow>
              )}
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>{agent.department}</TableCell>
                  <TableCell>{agent.phone}</TableCell>
                  <TableCell>
                    <Badge variant={agent.available ? "default" : "secondary"}>
                      {agent.available ? "Available" : "Busy"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={agent.available}
                      onCheckedChange={() => toggleAvailability(agent)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
