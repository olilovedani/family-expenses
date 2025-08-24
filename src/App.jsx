import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Trash2, Edit3, Filter, PieChart as PieIcon, Plus, Save, FileSpreadsheet } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Bar, BarChart, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

function uid() { return Math.random().toString(36).slice(2, 10); }

const STORAGE_KEY = "family-expenses-v1";
const HOUSEHOLD_KEY = "family-expenses-household";

const DEFAULT_COLORS = [
  "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e11d48",
];

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveExpenses(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
function formatMoney(n) {
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item) ?? "";
    map.set(k, (map.get(k) || []).concat(item));
  }
  return map;
}
function monthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Supabase client
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (SUPA_URL && SUPA_KEY) ? createClient(SUPA_URL, SUPA_KEY) : null;

export default function FamilyExpensesApp() {
  const [expenses, setExpenses] = useState(loadExpenses());
  const [form, setForm] = useState({
    id: "", date: new Date().toISOString().slice(0, 10), from: "", to: "", category: "", amount: "", spender: "", note: ""
  });
  const [editingId, setEditingId] = useState(null);

  // облако
  const [household, setHousehold] = useState(localStorage.getItem(HOUSEHOLD_KEY) || "");
  const cloudEnabled = Boolean(supabase && household);

  // фильтры
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fSpender, setFSpender] = useState("");
  const [fCategory, setFCategory] = useState("");

  useEffect(() => { saveExpenses(expenses); }, [expenses]);

  // первичная загрузка из облака + realtime
  useEffect(() => {
    if (!cloudEnabled) return;
    let isMounted = true;

    async function loadCloud() {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("household", household)
        .order("date", { ascending: false });
      if (!error && isMounted) setExpenses(data.map(dbToUi));
    }
    loadCloud();

    const channel = supabase.channel(`exp_${household}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `household=eq.${household}` },
        () => loadCloud()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [household, cloudEnabled]);

  const uniqueSpenders = useMemo(
    () => Array.from(new Set(expenses.map(e => e.spender).filter(Boolean))).sort(),
    [expenses]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(expenses.map(e => e.category).filter(Boolean))).sort(),
    [expenses]
  );

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (fromDate && e.date < fromDate) return false;
      if (toDate && e.date > toDate) return false;
      if (fSpender && e.spender !== fSpender) return false;
      if (fCategory && e.category !== fCategory) return false;
      if (q) {
        const s = (e.from + " " + e.to + " " + e.category + " " + e.spender + " " + (e.note || "")).toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [expenses, fromDate, toDate, fSpender, fCategory, q]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [filtered]);

  function resetForm() {
    setForm({ id: "", date: new Date().toISOString().slice(0, 10), from: "", to: "", category: "", amount: "", spender: "", note: "" });
    setEditingId(null);
  }

  async function submitForm(ev) {
    ev.preventDefault();
    const amt = parseFloat(String(form.amount).replace(",", "."));
    if (!form.date || !form.category || !form.spender || !amt) {
      alert("Пожалуйста, заполните дату, сумму, категорию и имя (кем потрачено).");
      return;
    }
    const entry = {
      id: editingId || uid(),
      date: form.date,
      from: form.from.trim(),
      to: form.to.trim(),
      category: form.category.trim(),
      amount: amt,
      spender: form.spender.trim(),
      note: form.note?.trim()
    };

    // локально
    setExpenses(prev => {
      const next = editingId ? prev.map(e => e.id === editingId ? entry : e) : [entry, ...prev];
      return next.sort((a, b) => (a.date < b.date ? 1 : -1));
    });

    // в облако
    if (cloudEnabled) {
      const row = uiToDb(entry, household);
      await supabase.from("expenses").upsert(row, { onConflict: "id" });
    }

    resetForm();
  }

  function editRow(e) {
    setEditingId(e.id);
    setForm({ ...e, amount: String(e.amount) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteRow(id) {
    if (!confirm("Удалить запись?")) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (cloudEnabled) {
      await supabase.from("expenses").delete().eq("id", id).eq("household", household);
    }
  }

  function exportCSV() {
    const header = ["id", "date", "from", "to", "category", "amount", "spender", "note"];
    const rows = expenses.map(e => header.map(k => ("" + (e[k] ?? "")).replaceAll('"', '""')));
    const csv = [header.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSV(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result);
        const lines = text.split(/\r?\n/).filter(Boolean);
        const header = lines.shift().split(",").map(h => h.replaceAll('"', "").trim());
        const idx = (name) => header.indexOf(name);
        const list = lines.map(line => {
          const cols =
            line.match(/((?:^|,)(?:\"(?:[^\"]|\"\")*\"|[^,]*))/g)?.map(s => s.replace(/^,?\"?|\"?$/g, "").replaceAll('""', '"')) ||
            line.split(",");
          return {
            id: cols[idx("id")] || uid(),
            date: cols[idx("date")] || new Date().toISOString().slice(0, 10),
            from: cols[idx("from")] || "",
            to: cols[idx("to")] || "",
            category: cols[idx("category")] || "",
            amount: parseFloat((cols[idx("amount")] || "0").replace(",", ".")) || 0,
            spender: cols[idx("spender")] || "",
            note: cols[idx("note")] || "",
          };
        });
        setExpenses(prev => {
          const map = new Map(prev.map(e => [e.id, e]));
          for (const e of list) map.set(e.id, e);
          return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
        });
        if (cloudEnabled) {
          const rows = list.map(e => uiToDb(e, household));
          await supabase.from("expenses").upsert(rows, { onConflict: "id" });
        }
      } catch (err) {
        alert("Не удалось импортировать CSV: " + err);
      }
    };
    reader.readAsText(file);
  }

  function exportXLSX() {
    try {
      const bySpender = Array.from(groupBy(filtered, e => e.spender)).map(([name, items]) => ({ name: name || "(не указано)", value: items.reduce((s, x) => s + x.amount, 0) }));
      const byCategory = Array.from(groupBy(filtered, e => e.category)).map(([name, items]) => ({ name: name || "(без категории)", value: items.reduce((s, x) => s + x.amount, 0) }));
      const gm = groupBy(filtered, e => monthKey(e.date));
      const months = Array.from(gm.keys()).filter(Boolean).sort();
      const byMonth = months.map(m => ({ month: m, total: gm.get(m).reduce((s, x) => s + x.amount, 0) }));

      const rows = filtered.map(e => ({
        "Дата": e.date, "От": e.from, "До": e.to, "Категория": e.category, "Сумма": e.amount, "Кем": e.spender, "Примечание": e.note || ""
      }));

      const wsMain = XLSX.utils.json_to_sheet(rows, { origin: 0 });
      wsMain["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];

      const wsSpenders = XLSX.utils.aoa_to_sheet([["Имя", "Сумма"], ...bySpender.map(r => [r.name, r.value])]);
      const wsCats = XLSX.utils.aoa_to_sheet([["Категория", "Сумма"], ...byCategory.map(r => [r.name, r.value])]);
      const wsMonths = XLSX.utils.aoa_to_sheet([["Месяц", "Итого"], ...byMonth.map(r => [r.month, r.total])]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsMain, "Расходы");
      XLSX.utils.book_append_sheet(wb, wsSpenders, "По именам");
      XLSX.utils.book_append_sheet(wb, wsCats, "По категориям");
      XLSX.utils.book_append_sheet(wb, wsMonths, "По месяцам");

      const fname = `expenses_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (err) {
      alert("Не удалось сформировать XLSX: " + err);
    }
  }

  const bySpender = useMemo(
    () => Array.from(groupBy(filtered, e => e.spender)).map(([name, items]) => ({ name: name || "(не указано)", value: items.reduce((s, x) => s + x.amount, 0) })),
    [filtered]
  );
  const byCategory = useMemo(
    () => Array.from(groupBy(filtered, e => e.category)).map(([name, items]) => ({ name: name || "(без категории)", value: items.reduce((s, x) => s + x.amount, 0) })),
    [filtered]
  );

  const byMonth = useMemo(() => {
    const gm = groupBy(filtered, e => monthKey(e.date));
    const months = Array.from(gm.keys()).filter(Boolean).sort();
    return months.map(m => ({ month: m, total: gm.get(m).reduce((s, x) => s + x.amount, 0) }));
  }, [filtered]);

  const stackedBySpenderMonth = useMemo(() => {
    const months = Array.from(new Set(filtered.map(e => monthKey(e.date)).filter(Boolean))).sort();
    const spenders = Array.from(new Set(filtered.map(e => e.spender).filter(Boolean))).sort();
    const byM = groupBy(filtered, e => monthKey(e.date));
    return months.map(m => {
      const row = { month: m };
      for (const s of spenders) {
        row[s] = (byM.get(m) || []).filter(e => e.spender === s).reduce((sum, x) => sum + x.amount, 0);
      }
      return row;
    });
  }, [filtered]);

  const spendersList = useMemo(() => Array.from(new Set(filtered.map(e => e.spender).filter(Boolean))).sort(), [filtered]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Панель облачной синхронизации */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Общий доступ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 items-end">
            <div className="md:col-span-2">
              <Label>Код семьи (общее пространство)</Label>
              <Input
                placeholder="например, novikova-family"
                value={household}
                onChange={e => { setHousehold(e.target.value.trim()); }}
              />
              <div className="text-xs text-slate-500 mt-1">
                Все, кто введут такой же код, увидят одинаковые данные. {supabase ? "" : "Добавь переменные VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, чтобы включить облачную синхронизацию."}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                if (!supabase) { alert("Облако недоступно: не задан VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"); return; }
                localStorage.setItem(HOUSEHOLD_KEY, household || "");
                window.location.reload();
              }}>Применить</Button>
              <Button variant="secondary" onClick={() => {
                setHousehold("");
                localStorage.removeItem(HOUSEHOLD_KEY);
                window.location.reload();
              }}>Отключить</Button>
            </div>
            <div className="md:col-span-3 text-sm text-slate-600">
              Статус: {cloudEnabled ? "облако подключено" : "локальный режим"}.
            </div>
          </CardContent>
        </Card>

        {/* Верхняя панель */}
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-semibold">Аналитика семейных расходов</h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCSV} className="flex items-center gap-2"><Download className="h-4 w-4" />Экспорт CSV</Button>
            <Button variant="secondary" onClick={exportXLSX} className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Экспорт XLSX</Button>
            <label className="inline-flex items-center gap-2">
              <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && importCSV(e.target.files[0])} />
              <Button variant="secondary" className="flex items-center gap-2"><Upload className="h-4 w-4" />Импорт CSV</Button>
            </label>
          </div>
        </header>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{editingId ? "Редактировать расход" : "Добавить расход"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="col-span-2">
                <Label>Дата</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <Label>От (источник)</Label>
                <Input placeholder="Кошелек/счет" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div>
                <Label>До (получатель)</Label>
                <Input placeholder="Магазин/человек" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} />
              </div>
              <div>
                <Label>Куда / категория</Label>
                <Input placeholder="Продукты, аренда, топливо..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required />
              </div>
              <div>
                <Label>Сумма</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div>
                <Label>Кем потрачено (имя)</Label>
                <Input placeholder="Ольга, Артём..." value={form.spender} onChange={e => setForm(f => ({ ...f, spender: e.target.value }))} required />
              </div>
              <div className="md:col-span-5">
                <Label>Примечание</Label>
                <Textarea placeholder="Любая деталь (необязательно)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="w-full flex items-center gap-2"><Save className="h-4 w-4" />{editingId ? "Сохранить" : "Добавить"}</Button>
                {editingId && <Button type="button" variant="secondary" onClick={resetForm}>Отмена</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Фильтры и список</CardTitle>
            <Button variant="secondary" onClick={() => setFilterOpen(v => !v)}>Показать / скрыть фильтры</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {filterOpen && (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <Label>От даты</Label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label>До даты</Label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <div>
                  <Label>Имя (кем потрачено)</Label>
                  <Input list="spenders" placeholder="Все" value={fSpender} onChange={e => setFSpender(e.target.value)} />
                  <datalist id="spenders">
                    {uniqueSpenders.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <Label>Категория</Label>
                  <Input list="cats" placeholder="Все" value={fCategory} onChange={e => setFCategory(e.target.value)} />
                  <datalist id="cats">
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="md:col-span-2">
                  <Label>Поиск</Label>
                  <Input placeholder="Магазин, примечание, категория..." value={q} onChange={e => setQ(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Всего записей: {filtered.length}</div>
              <div className="text-lg font-semibold">Итого: {formatMoney(total)}</div>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>От</TableHead>
                    <TableHead>До</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Кем</TableHead>
                    <TableHead>Примечание</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                      <TableCell>{e.from}</TableCell>
                      <TableCell>{e.to}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(e.amount)}</TableCell>
                      <TableCell>{e.spender}</TableCell>
                      <TableCell className="max-w-[24rem] truncate" title={e.note}>{e.note}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="secondary" onClick={() => editRow(e)}><Edit3 className="h-4 w-4" /></Button>
                          <Button size="icon" variant="destructive" onClick={() => deleteRow(e.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-500 py-8">Нет записей. Добавьте расходы сверху.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieIcon className="h-5 w-5" />Аналитика</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="spenders" className="w-full">
              <TabsList c
