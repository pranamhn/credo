"use client";
import { useState } from "react";
import { ArrowRight, DollarSign, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowButton } from "./GlowButton";
import { DataCard } from "./DataCard";

export interface SendRecipient {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface SendInvoicesPanelProps {
  title?: string;
  subtitle?: string;
  recipients?: SendRecipient[];
  services?: string[];
  onSend?: (data: { recipientId: string; service: string; amount: string }) => void;
  className?: string;
}

const DEFAULT_RECIPIENTS: SendRecipient[] = [
  { id: "1", name: "Dave",   initials: "DV", color: "#7c3aed" },
  { id: "2", name: "Ismael", initials: "IS", color: "#0891b2" },
  { id: "3", name: "Dinda",  initials: "DN", color: "#db2777" },
];

const DEFAULT_SERVICES = [
  "Maintenance Service",
  "Consulting",
  "Software Development",
  "Design",
];

export function SendInvoicesPanel({
  title = "Send Invoices",
  subtitle = "Kirim tagihan ke penerima",
  recipients = DEFAULT_RECIPIENTS,
  services = DEFAULT_SERVICES,
  onSend,
  className,
}: SendInvoicesPanelProps) {
  const [selectedId, setSelectedId]     = useState(recipients[0]?.id ?? "");
  const [service, setService]           = useState(services[0] ?? "");
  const [amount, setAmount]             = useState("");

  function handleSend() {
    if (!selectedId || !service) return;
    onSend?.({ recipientId: selectedId, service, amount });
  }

  return (
    <DataCard className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Recipient picker */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">Choose Recipient</p>
        <div className="flex items-center gap-2">
          {recipients.map((r) => (
            <div key={r.id} className="flex flex-col items-center gap-1">
              <button
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-offset-2 transition-all",
                  selectedId === r.id ? "ring-violet-500" : "ring-transparent"
                )}
                style={{ background: r.color }}
              >
                {r.initials}
              </button>
              <span className="text-[10px] text-slate-400">{r.name}</span>
            </div>
          ))}
          <button className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0 self-start">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Service */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">Choose Service</p>
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 transition-all"
        >
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">Amount</p>
        <div className="relative">
          <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Insert amount"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 transition-all"
          />
        </div>
      </div>

      <GlowButton
        variant="primary"
        className="w-full justify-center"
        icon={<Send className="h-3.5 w-3.5" />}
        onClick={handleSend}
      >
        Send Invoices
      </GlowButton>
    </DataCard>
  );
}
