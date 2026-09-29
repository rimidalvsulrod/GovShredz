"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/client/store";
import { Card, Skeleton } from "@/components/ui";
import { ago } from "@/shared/units";
import { device, flag, Pill, place, Table } from "../../admin-ui";

type Row = {
  id: string;
  email: string;
  username: string;
  name: string;
  banned: boolean;
  first_seen: string;
  last_seen: string;
  hits: number;
  user_agent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

export default function IpPage() {
  const { ip } = useParams<{ ip: string }>();
  const addr = decodeURIComponent(ip);
  const { data } = useData<{ ip: string; accounts: Row[] }>(`/api/admin/ips?ip=${encodeURIComponent(addr)}`);
  return (
    <div className="rise space-y-4">
      <Link href="/admin?tab=users" className="text-[13px] text-muted">
        ← All users
      </Link>
      <Card>
        <div className="text-[12px] font-semibold tracking-wider text-muted uppercase">IP address</div>
        <div className="mt-1 font-mono text-[26px] font-bold">
          {flag(data?.accounts[0]?.country)} {addr}
        </div>
        {data?.accounts[0] && <div className="text-[14px] text-muted">{place(data.accounts[0]) || "Unknown location"}</div>}
        {data && data.accounts.length > 1 && (
          <div className="mt-2">
            <Pill tone="warn">{data.accounts.length} accounts share this IP</Pill>
          </div>
        )}
      </Card>
      {!data ? (
        <Skeleton className="h-40" />
      ) : (
        <Table head={["Account", "Email", "Device", "Visits", "First seen", "Last seen"]}>
          {data.accounts.map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2">
                <Link href={`/admin/users/${a.id}`} className="font-semibold text-lime hover:underline">
                  {a.name} <span className="text-muted">@{a.username}</span>
                </Link>
                {a.banned && (
                  <span className="ml-1.5">
                    <Pill tone="bad">Suspended</Pill>
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{a.email}</td>
              <td className="px-3 py-2 text-muted">{device(a.user_agent)}</td>
              <td className="tabular px-3 py-2">{a.hits}</td>
              <td className="px-3 py-2 text-dim">{new Date(a.first_seen).toLocaleString()}</td>
              <td className="px-3 py-2 text-dim">{ago(a.last_seen)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
