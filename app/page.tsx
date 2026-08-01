"use client";

import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string; builtIn?: boolean };
type Product = { id: string; categoryId: string; name: string; aliases?: string[]; builtIn?: boolean };
type ListItem = { id: string; productId?: string; categoryId: string; categoryName: string; name: string; quantity: string; unit: string; note: string; bought: boolean };
type ShoppingList = { id: string; items: ListItem[]; createdAt?: string; completedAt?: string };
type AppState = { version: 1; categories: Category[]; products: Product[]; active: ShoppingList; template: ShoppingList; history: ShoppingList[]; frequency: Record<string, number> };

const key = "shopping-list-v1";
const supabaseUrl = "https://kwqvhdhbjjskatmvgoyn.supabase.co";
const supabaseKey = "sb_publishable_22GfukEaNTQGvqbGryoOXw_JC39rQw5";
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const categorySeed: [string, string[]][] = [
  ["Молочные продукты", ["Молоко", "Кефир", "Йогурт", "Творог", "Сметана", "Сыр", "Сливочное масло", "Яйца"]],
  ["Хлеб и выпечка", ["Хлеб", "Батон", "Лаваш", "Булочки", "Печенье"]],
  ["Крупы и макароны", ["Рис", "Гречка", "Овсянка", "Макароны", "Мука", "Сахар", "Соль"]],
  ["Мясо и птица", ["Курица", "Фарш", "Говядина", "Свинина", "Сосиски", "Колбаса"]],
  ["Рыба", ["Филе рыбы", "Рыба целиком", "Рыбные консервы"]],
  ["Овощи", ["Картофель", "Морковь", "Лук", "Чеснок", "Огурцы", "Помидоры", "Капуста", "Перец", "Зелень"]],
  ["Фрукты", ["Яблоки", "Бананы", "Груши", "Апельсины", "Мандарины", "Лимоны", "Ягоды"]],
  ["Заморозка", ["Овощные смеси", "Ягоды", "Пельмени", "Мороженое"]],
  ["Сладости и снеки", ["Шоколад", "Конфеты", "Вафли", "Чипсы", "Сухарики"]],
  ["Напитки", ["Вода", "Сок", "Чай", "Кофе", "Какао"]],
  ["Хозяйственные товары", ["Туалетная бумага", "Салфетки", "Мусорные пакеты", "Средство для посуды", "Стиральный порошок", "Губки"]],
  ["Другое", []],
];
const initialState = (): AppState => {
  const categories = categorySeed.map(([name], i) => ({ id: `cat-${i}`, name, builtIn: true }));
  const products = categorySeed.flatMap(([, names], i) => names.map((name, p) => ({ id: `p-${i}-${p}`, categoryId: categories[i].id, name, builtIn: true, aliases: name === "Огурцы" ? ["огурец"] : name === "Помидоры" ? ["томаты", "помидор"] : [] })));
  return { version: 1, categories, products, active: { id: uid(), createdAt: new Date().toISOString(), items: [] }, template: { id: uid(), items: [] }, history: [], frequency: {} };
};
const normalize = (value: string) => value.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]/g, "");
const capitalizeFirst = (value: string) => value ? value[0].toLocaleUpperCase("ru-RU") + value.slice(1) : value;
const distanceOne = (a: string, b: string) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, diff = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; } else { if (++diff > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } } return true; };
const displayDetail = (item: ListItem) => item.note;

const categoryPhotos: Record<string, string> = {
  "cat-0": "pantry top-left", "cat-1": "pantry top-right", "cat-2": "pantry bottom-left", "cat-3": "pantry bottom-right",
  "cat-4": "fresh top-left", "cat-5": "fresh top-right", "cat-6": "fresh bottom-left", "cat-7": "fresh bottom-right",
  "cat-8": "home top-left", "cat-9": "home top-right", "cat-10": "home bottom-left", "cat-11": "home bottom-right",
};
function Thumb({ label, categoryId, large = false }: { label: string; categoryId?: string; large?: boolean }) {
  const photo = categoryId && categoryPhotos[categoryId];
  return <span className={`thumb ${large ? "thumb-large" : ""} ${photo ? `photo ${photo}` : ""}`} aria-hidden="true">{photo ? "" : label.slice(0, 1).toUpperCase()}</span>;
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"new" | "template" | "store">("new");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [sheet, setSheet] = useState<"trip" | "item" | "product" | "category" | "finish" | null>(null);
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ name: "", quantity: "", unit: "шт.", note: "" });
  const [roomId, setRoomId] = useState("");
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => { try { const saved = localStorage.getItem(key); if (saved) { const restored = JSON.parse(saved) as AppState; restored.products = restored.products.map((product) => product.builtIn ? product : { ...product, name: capitalizeFirst(product.name) }); const customProductIds = new Set(restored.products.filter((product) => !product.builtIn).map((product) => product.id)); const tidy = (list: ShoppingList) => ({ ...list, items: list.items.map((item) => customProductIds.has(item.productId ?? "") ? { ...item, name: capitalizeFirst(item.name) } : item) }); setState({ ...restored, active: tidy(restored.active), template: tidy(restored.template), history: restored.history.map(tidy) }); } const url = new URL(window.location.href); const room = url.searchParams.get("room") || uid(); if (!url.searchParams.get("room")) { url.searchParams.set("room", room); window.history.replaceState(null, "", url); } setRoomId(room); } finally { setReady(true); } }, []);
  useEffect(() => { if (ready) localStorage.setItem(key, JSON.stringify(state)); }, [state, ready]);
  useEffect(() => { if (!roomId) return; const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", "x-family-room": roomId }; const load = async () => { try { const response = await fetch(`${supabaseUrl}/rest/v1/family_lists?room_id=eq.${roomId}&select=state`, { headers }); const rows = await response.json(); if (rows?.[0]?.state) setState(rows[0].state as AppState); setRemoteReady(true); } catch { setRemoteReady(true); } }; load(); }, [roomId]);
  useEffect(() => { if (!remoteReady || !roomId) return; const timer = window.setTimeout(() => { fetch(`${supabaseUrl}/rest/v1/family_lists?on_conflict=room_id`, { method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal", "x-family-room": roomId }, body: JSON.stringify({ room_id: roomId, state, updated_at: new Date().toISOString() }) }).catch(() => undefined); }, 700); return () => window.clearTimeout(timer); }, [state, roomId, remoteReady]);
  useEffect(() => { if (!remoteReady || !roomId) return; const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "x-family-room": roomId }; const refresh = async () => { try { const response = await fetch(`${supabaseUrl}/rest/v1/family_lists?room_id=eq.${roomId}&select=state`, { headers }); const rows = await response.json(); if (rows?.[0]?.state) setState(rows[0].state as AppState); } catch { /* local copy stays available offline */ } }; const timer = window.setInterval(refresh, 4000); return () => window.clearInterval(timer); }, [roomId, remoteReady]);
  const list = (tab === "template" || editingTemplate) ? state.template : state.active;
  const category = state.categories.find((item) => item.id === categoryId);
  const updateList = (next: ShoppingList) => setState((s) => editingTemplate ? { ...s, template: next } : { ...s, active: next });
  const addProduct = (product: Product) => {
    if (list.items.some((i) => i.productId === product.id)) return;
    const cat = state.categories.find((c) => c.id === product.categoryId)!;
    const item = { id: uid(), productId: product.id, categoryId: cat.id, categoryName: cat.name, name: product.name, quantity: "", unit: "", note: "", bought: false };
    updateList({ ...list, items: [...list.items, item] });
    if (!editingTemplate) setState((s) => ({ ...s, frequency: { ...s.frequency, [product.id]: (s.frequency[product.id] ?? 0) + 1 } }));
  };
  const removeItem = (item: ListItem) => updateList({ ...list, items: list.items.filter((i) => i.id !== item.id) });
  const deleteCustomProduct = (product: Product) => {
    if (!confirm(`Удалить «${product.name}» из личной библиотеки? Он также будет убран из текущего и готового списка.`)) return;
    setState((s) => ({ ...s, products: s.products.filter((item) => item.id !== product.id), active: { ...s.active, items: s.active.items.filter((item) => item.productId !== product.id) }, template: { ...s.template, items: s.template.items.filter((item) => item.productId !== product.id) } }));
  };
  const saveItem = () => { if (!editing) return; updateList({ ...list, items: list.items.map((i) => i.id === editing.id ? { ...i, note: draft.note } : i) }); setSheet(null); };
  const updateNote = (itemId: string, note: string) => updateList({ ...list, items: list.items.map((item) => item.id === itemId ? { ...item, note } : item) });
  const createProduct = () => {
    if (!categoryId || !draft.name.trim()) return;
    const product = { id: uid(), categoryId, name: capitalizeFirst(draft.name.trim()), builtIn: false };
    setState((s) => ({ ...s, products: [...s.products, product] }));
    const cat = state.categories.find((c) => c.id === categoryId)!;
    const item = { id: uid(), productId: product.id, categoryId, categoryName: cat.name, name: product.name, quantity: "", unit: "", note: draft.note, bought: false };
    updateList({ ...list, items: [...list.items, item] }); setSheet(null);
  };
  const createCategory = () => { if (!draft.name.trim()) return; setState((s) => ({ ...s, categories: [...s.categories, { id: uid(), name: draft.name.trim() }] })); setSheet(null); };
  const beginTrip = (source?: ShoppingList) => { if (state.active.items.length && !confirm("Заменить текущий список? Несохранённые изменения в нём будут потеряны.")) return; setState((s) => ({ ...s, active: { id: uid(), items: (source?.items ?? []).map((i) => ({ ...i, id: uid(), bought: false })) } })); setTab("new"); setEditingTemplate(false); setCategoryId(null); setSheet(null); };
  const finish = () => { setState((s) => ({ ...s, history: [{ ...s.active, id: uid(), completedAt: new Date().toISOString(), items: s.active.items.map((i) => ({ ...i })) }, ...s.history].slice(0, 2), active: { id: uid(), createdAt: new Date().toISOString(), items: [] } })); setSheet(null); setTab("new"); };
  const grouped = useMemo(() => state.categories.map((c) => ({ category: c, items: list.items.filter((i) => i.categoryId === c.id) })).filter((g) => g.items.length), [state.categories, list.items]);
  const products = useMemo(() => state.products.filter((p) => p.categoryId === categoryId).filter((p) => { const q = normalize(query); if (!q) return true; const values = [p.name, ...(p.aliases ?? [])].map(normalize); return values.some((v) => v.startsWith(q) || v.includes(q) || (q.length >= 4 && distanceOne(v, q))); }).sort((a, b) => (state.frequency[b.id] ?? 0) - (state.frequency[a.id] ?? 0) || a.name.localeCompare(b.name, "ru")), [state.products, categoryId, query, state.frequency]);
  const openCategory = (id: string) => { setCategoryId(id); setQuery(""); };
  const openEdit = (item: ListItem) => { setEditing(item); setDraft({ name: item.name, quantity: "", unit: "", note: item.note }); setSheet("item"); };
  const openNewProduct = () => { setDraft({ name: "", quantity: "", unit: "", note: "" }); setSheet("product"); };
  const historyDate = (entry: ShoppingList) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(entry.createdAt ?? entry.completedAt ?? Date.now()));
  if (!ready || !remoteReady) return <main className="app loading">Загружаем семейный список…</main>;

  const ListRow = ({ item, store = false }: { item: ListItem; store?: boolean }) => <div className={`item-row ${item.bought ? "bought" : ""}`} onClick={() => store ? updateList({ ...list, items: list.items.map((i) => i.id === item.id ? { ...i, bought: !i.bought } : i) }) : openEdit(item)}>
    {store && <span className="check" aria-hidden="true">{item.bought ? "✓" : ""}</span>}<Thumb label={item.name} categoryId={item.categoryId}/><div className="item-copy"><strong>{item.name}</strong>{displayDetail(item) && <span>{displayDetail(item)}</span>}</div>{!store && <button className="icon-button danger" aria-label={`Удалить ${item.name}`} onClick={(e) => { e.stopPropagation(); removeItem(item); }}>×</button>}</div>;
  const CategoryBrowser = () => category ? <section className="screen detail"><header className="topbar"><button className="back" onClick={() => setCategoryId(null)}>‹ Назад</button><h1>{category.name}</h1></header><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Найти в категории «${category.name}»`}/>{query && <button onClick={() => setQuery("")} aria-label="Очистить поиск">×</button>}</label><div className="product-list">{products.map((product) => { const selected = list.items.find((i) => i.productId === product.id); return <div className={`product-row ${selected ? "selected" : ""}`} key={product.id}><Thumb label={product.name} categoryId={product.categoryId}/><div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 5 }}><strong>{product.name}</strong>{selected && <input value={selected.note} onChange={(e) => updateNote(selected.id, e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Заметка" aria-label={`Заметка к товару ${product.name}`} style={{ width: "100%", height: 34, border: "1px solid #E5E7E2", borderRadius: 8, background: "#fff", padding: "0 9px", fontSize: 15 }}/>}</div>{!product.builtIn && <button className="delete-product" aria-label={`Удалить ${product.name} из библиотеки`} onClick={() => deleteCustomProduct(product)}>×</button>}<button className={selected ? "added" : "add"} aria-label={selected ? `Убрать ${product.name}` : `Добавить ${product.name}`} onClick={(e) => { e.stopPropagation(); selected ? removeItem(selected) : addProduct(product); }}>{selected ? "Добавлено" : "+"}</button></div>; })}</div>{!products.length && <div className="empty compact">В этой категории ничего не найдено. Поиск работает только внутри неё.</div>}<button className="secondary full" onClick={openNewProduct}>＋ Добавить свой товар</button></section> : <section className="screen"><header className="hero"><div><h1>{editingTemplate ? "Редактирование списка" : "Новый список"}</h1><p>{editingTemplate ? "Добавляйте регулярные покупки" : "Выберите продукты для покупки"}</p></div>{!editingTemplate && <button className="text-button" onClick={() => setSheet("trip")}>Начать заново</button>}</header><div className="category-grid">{state.categories.map((cat) => { const count = list.items.filter((i) => i.categoryId === cat.id).length; return <button className="category-card" key={cat.id} onClick={() => openCategory(cat.id)}><Thumb label={cat.name} categoryId={cat.id} large/><span>{cat.name}</span>{count > 0 && <small>{count} выбрано</small>}</button>; })}<button className="category-card new-category" onClick={() => { setDraft({ name: "", quantity: "", unit: "", note: "" }); setSheet("category"); }}>＋<span>Новая категория</span></button></div>{editingTemplate && <button className="secondary full" onClick={() => setEditingTemplate(false)}>Готово</button>}{!editingTemplate && <button className="primary full" disabled={!list.items.length} onClick={() => setTab("store")}>Перейти к списку</button>}</section>;

  return <main className="app"><div className="content">{tab === "new" && <CategoryBrowser />}{tab === "template" && (editingTemplate ? <CategoryBrowser /> : <section className="screen"><header className="hero"><div><h1>Готовый список</h1><p>Ваши регулярные покупки</p></div><button className="text-button" onClick={() => setEditingTemplate(true)}>Изменить</button></header>{grouped.length ? <div className="list-groups">{grouped.map((g) => <section className="list-group" key={g.category.id}><h2>{g.category.name}</h2>{g.items.map((i) => <ListRow key={i.id} item={i}/>)}</section>)}</div> : <div className="empty"><b>Готовый список пока пуст</b><span>Добавьте регулярные покупки, чтобы повторять их одним нажатием.</span><button className="primary" onClick={() => setEditingTemplate(true)}>Добавить товары</button></div>}<button className="primary full" disabled={!state.template.items.length} onClick={() => beginTrip(state.template)}>Использовать для нового списка</button></section>)}{tab === "store" && <section className="screen"><header className="hero store-head"><div><h1>В магазине</h1><p>{list.items.filter((i) => !i.bought).length ? `Осталось ${list.items.filter((i) => !i.bought).length} товаров` : "Список пуст"}</p></div><strong>{list.items.filter((i) => i.bought).length} из {list.items.length}</strong></header><div className="progress"><i style={{ width: `${list.items.length ? list.items.filter((i) => i.bought).length / list.items.length * 100 : 0}%` }}/></div>{grouped.length ? <div className="list-groups store-groups">{grouped.map((g) => <section className="list-group" key={g.category.id}><h2>{g.category.name}</h2>{g.items.map((i) => <ListRow key={i.id} item={i} store/>)}</section>)}</div> : <div className="empty"><b>Список покупок пуст</b><span>Добавьте товары дома или вручную здесь.</span></div>}<button className="secondary full" onClick={() => { setEditingTemplate(false); setCategoryId(state.categories.at(-1)?.id ?? null); setSheet(null); setTab("new"); }}>＋ Добавить вручную</button><button className="primary full" disabled={!list.items.length} onClick={() => setSheet("finish")}>Завершить покупки</button></section>}</div><nav className="tabs" aria-label="Разделы приложения">{([ ["new", "☷", "Новый список"], ["template", "☰", "Готовый список"], ["store", "⌖", "В магазине"] ] as const).map(([id, icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setCategoryId(null); setEditingTemplate(false); }}><span>{icon}</span>{label}</button>)}</nav>
    {sheet && <div className="overlay" role="presentation" onMouseDown={() => setSheet(null)}><section className="sheet" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>{sheet === "trip" && <><h2>Начать новый поход</h2><p>Выберите основу для списка.</p><button className="secondary full" onClick={() => beginTrip()}>Пустой список</button><button className="secondary full" disabled={!state.template.items.length} onClick={() => beginTrip(state.template)}>Готовый список</button>{state.history.map((h) => <button className="secondary full" key={h.id} onClick={() => beginTrip(h)}>Список · {historyDate(h)} · {h.items.length} товаров</button>)}</>}{sheet === "item" && <><h2>{editing?.name}</h2><label>Заметка<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Например, спелые"/></label><button className="primary full" onClick={saveItem}>Сохранить</button></>}{sheet === "product" && <><h2>Добавить свой товар</h2><label>Название товара<input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: capitalizeFirst(e.target.value) })} placeholder="Например, детское питание"/></label><label>Заметка<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}/></label><button className="primary full" disabled={!draft.name.trim()} onClick={createProduct}>Добавить товар</button></>}{sheet === "category" && <><h2>Новая категория</h2><label>Название категории<input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Например, Для дома"/></label><button className="primary full" disabled={!draft.name.trim()} onClick={createCategory}>Создать категорию</button></>}{sheet === "finish" && <><h2>Завершить покупки?</h2><p>Этот список сохранится в истории, откуда его можно будет повторить.</p><button className="primary full" onClick={finish}>Завершить покупки</button><button className="text-button full" onClick={() => setSheet(null)}>Продолжить покупки</button></>}</section></div>}</main>;
}
