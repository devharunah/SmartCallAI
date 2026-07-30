"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORIES, type Agent, type Category } from "@/lib/types";

interface AgentFormValue {
  name: string;
  phone: string;
  department: Category;
  categories: Category[];
  available: boolean;
}

const EMPTY_FORM: AgentFormValue = {
  name: "",
  phone: "",
  department: CATEGORIES[0],
  categories: [],
  available: true,
};

export function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (res.status === 401) {
      window.location.href = "/login?next=/admin";
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data: Agent[] = await res.json();
    setAgents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
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

  const createAgent = useCallback(
    async (value: AgentFormValue) => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (res.ok) {
        setCreating(false);
        await load();
      }
      return res.ok;
    },
    [load]
  );

  const saveAgent = useCallback(
    async (id: string, value: AgentFormValue) => {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (res.ok) {
        setEditingId(null);
        await load();
      }
      return res.ok;
    },
    [load]
  );

  const removeAgent = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      setConfirmingDeleteId(null);
      if (res.ok) await load();
    },
    [load]
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        {!creating && (
          <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
            Add Agent
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentForm
              initial={EMPTY_FORM}
              onCancel={() => setCreating(false)}
              onSave={createAgent}
              submitLabel="Create Agent"
            />
          </CardContent>
        </Card>
      )}

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
                <TableHead>Handles</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No agents found.
                  </TableCell>
                </TableRow>
              )}
              {agents.map((agent) =>
                editingId === agent.id ? (
                  <TableRow key={agent.id}>
                    <TableCell colSpan={7}>
                      <AgentForm
                        initial={agent}
                        onCancel={() => setEditingId(null)}
                        onSave={(value) => saveAgent(agent.id, value)}
                        submitLabel="Save Changes"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>{agent.department}</TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {agent.categories.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">
                          {c}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>{agent.phone}</TableCell>
                    <TableCell>
                      <Badge
                        className={agent.available ? "bg-accent text-accent-foreground" : undefined}
                        variant={agent.available ? "default" : "secondary"}
                      >
                        {agent.available ? "Available" : "Busy"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={agent.available}
                        onCheckedChange={() => toggleAvailability(agent)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {confirmingDeleteId === agent.id ? (
                        <div className="flex justify-end gap-2">
                          <span className="self-center text-xs text-muted-foreground">
                            Remove {agent.name}?
                          </span>
                          <Button variant="destructive" size="sm" onClick={() => removeAgent(agent.id)}>
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmingDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingId(agent.id)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingDeleteId(agent.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentForm({
  initial,
  onCancel,
  onSave,
  submitLabel,
}: {
  initial: AgentFormValue;
  onCancel: () => void;
  onSave: (value: AgentFormValue) => Promise<boolean>;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [department, setDepartment] = useState<Category>(initial.department);
  const [categories, setCategories] = useState<Category[]>(
    initial.categories.length > 0 ? initial.categories : [initial.department]
  );
  const [available, setAvailable] = useState(initial.available);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (category: Category) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || categories.length === 0) {
      setError("Name, phone, and at least one category are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await onSave({ name, phone, department, categories, available });
    setSaving(false);
    if (!ok) setError("Something went wrong saving this agent.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-name">Name</Label>
          <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-phone">Phone</Label>
          <Input id="agent-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-department">Primary Department</Label>
        <select
          id="agent-department"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={department}
          onChange={(e) => setDepartment(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Handles these categories</Label>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={categories.includes(c)}
                onChange={() => toggleCategory(c)}
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={available} onCheckedChange={setAvailable} />
        <Label>Available</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
