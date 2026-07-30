"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Analytics } from "@/lib/calls";

const COLORS = ["#00d4a4", "#3772cf", "#f55a3c", "#c37d0d", "#1ba673", "#888888", "#00b48a"];

export function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/analytics");
    if (res.status === 401) {
      window.location.href = "/login?next=/analytics";
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json: Analytics = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
  }, [load]);

  if (loading && !data) {
    return <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">Loading analytics...</div>;
  }

  if (!data) return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <Button variant="outline" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Calls" value={data.totalCalls} />
        <StatCard label="Calls Today" value={data.callsToday} />
        <StatCard label="Active Agents" value={data.activeAgents} />
        <StatCard label="Busy Agents" value={data.busyAgents} />
        <StatCard label="Avg Confidence" value={`${data.avgConfidence}%`} />
        <StatCard label="Avg Routing Time" value={`${data.avgRoutingTimeMs}ms`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls by Department</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.callsByDepartment.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.callsByDepartment}
                    dataKey="count"
                    nameKey="category"
                    outerRadius={80}
                  >
                    {data.callsByDepartment.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Common Issues</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.callsByDepartment.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.callsByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00d4a4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transcript</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentCalls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No calls yet.
                  </TableCell>
                </TableRow>
              )}
              {data.recentCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="max-w-xs truncate">{call.transcript}</TableCell>
                  <TableCell>{call.category}</TableCell>
                  <TableCell>{call.assignedAgentName ?? "Queued"}</TableCell>
                  <TableCell>{call.confidence}%</TableCell>
                  <TableCell>{new Date(call.createdAt).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No calls yet.
    </div>
  );
}
