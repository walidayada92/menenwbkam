"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Workspaces, WorkspaceRole, workspaceWords } from "@/lib/workspace";
interface Member {
  id: string;
  role: WorkspaceRole;
  status: string;
  user: { email: string };
}
export function SellerTeam({ locale }: { locale: string }) {
  const t = workspaceWords(locale),
    [spaces, setSpaces] = useState<Workspaces | null>(null),
    [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const s = await api<Workspaces>("seller/workspaces");
    setSpaces(s);
    if (s.stores.find((store) => store.id === s.selectedId)?.role === "OWNER")
      setMembers(await api<Member[]>("seller/workspaces/team"));
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void action(
      "seller/workspaces/team",
      "POST",
      Object.fromEntries(new FormData(e.currentTarget)),
    );
  }
  const owner =
    spaces?.stores.find((s) => s.id === spaces.selectedId)?.role === "OWNER";
  return (
    <section className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">{t.workspace}</span>
          <h1>{t.team}</h1>
          <p>{t.teamNote}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {spaces?.invitations.length ? (
        <article className="workspace-card">
          <h2>{t.invitations}</h2>
          {spaces.invitations.map((i) => (
            <div className="workspace-alert" key={i.id}>
              <div>
                <strong>{i.seller.businessName}</strong>
                <small>{t.roles[i.role]}</small>
              </div>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(
                      "seller/workspaces/invitations/" + i.id + "/accept",
                      { method: "POST", body: "{}" },
                    );
                    await api("seller/workspaces/select", {
                      method: "POST",
                      body: JSON.stringify({ sellerId: i.sellerId }),
                    });
                    window.location.assign("/" + locale + "/seller");
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                {t.accept}
              </button>
            </div>
          ))}
        </article>
      ) : null}
      {owner && (
        <>
          <form
            className="workspace-card form-grid invite-form"
            onSubmit={invite}
          >
            <h2>{t.invite}</h2>
            <label>
              {t.email}
              <input type="email" name="email" required />
            </label>
            <label>
              {t.role}
              <select name="role">
                {(
                  ["MANAGER", "CATALOG", "ORDERS", "ANALYST"] as WorkspaceRole[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>{t.invite} +</button>
            <p className="muted">{t.teamLocked}</p>
          </form>
          <article className="workspace-card">
            <h2>{t.members}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.email}</th>
                    <th>{t.role}</th>
                    <th>{t.account}</th>
                    <th>{t.remove}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.user.email}</td>
                      <td>
                        <select
                          aria-label={t.role}
                          disabled={busy}
                          value={m.role}
                          onChange={(e) =>
                            void action(
                              "seller/workspaces/team/" + m.id,
                              "PUT",
                              { role: e.target.value },
                            )
                          }
                        >
                          {(
                            [
                              "MANAGER",
                              "CATALOG",
                              "ORDERS",
                              "ANALYST",
                            ] as WorkspaceRole[]
                          ).map((r) => (
                            <option key={r} value={r}>
                              {t.roles[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="role-pill">
                          {m.status === "ACTIVE" ? t.active : t.pending}
                        </span>
                      </td>
                      <td>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              "seller/workspaces/team/" + m.id,
                              "DELETE",
                            )
                          }
                        >
                          {t.remove}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
