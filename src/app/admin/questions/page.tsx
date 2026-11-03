"use client";

import { useEffect, useState, useCallback } from "react";

type QuestionOption = {
  id: string;
  label: string;
  media_url?: string | null;
  position: number;
  guesses?: number;
  percentage?: number;
  avg_response_ms?: number;
  rank?: number;
  points?: number;
};

type AssignedSessionInfo = {
  session_id: string;
  session_name: string;
  status: string;
  position: number;
};

type Question = {
  id: string;
  title: string;
  category: string;
  type: "text" | "number" | "color" | "image";
  status: string;
  tags: string[];
  created_at: string;
  total_guesses?: number;
  sessions_used_count?: number;
  assigned_sessions?: AssignedSessionInfo[];
  session_position?: number | null;
  question_options: QuestionOption[];
};

type SessionSummary = {
  id: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  question_count: number;
};

const STATUSES = ["draft", "published", "archived"];
const CATEGORIES = [
  "Gifts",
  "Bathing Soap",
  "Breakfast",
  "Beverage",
  "Toothpaste",
  "Clothing Brands",
  "Football Club",
  "Sports",
  "Soft Drinks",
  "Swallow",
  "Family Role",
  "Hangout",
  "Colour",
  "Number",
  "Food",
  "Cars",
  "Country to Visit",
  "Romantic Gesture",
  "Snacks",
  "Social Media",
  "Drinks",
  "Fruits",
  "Protein",
  "Lifestyle",
];

const DEFAULT_COLOR_OPTIONS = [
  { label: "Blue", media_url: "#0018F9" },
  { label: "Red", media_url: "#FF1100" },
  { label: "Yellow", media_url: "#FFE600" },
  { label: "Purple", media_url: "#9E00FF" },
  { label: "Green", media_url: "#05FF00" },
  { label: "Sky Blue", media_url: "#00F0FF" },
  { label: "Light Green", media_url: "#ADFF00" },
  { label: "Black", media_url: "#050505" },
  { label: "White", media_url: "#FFFFFF" },
  { label: "Pink", media_url: "#FF00C7" },
];

// Curated 10-option Nigerian & Global Crowd Templates from Product Doc Pages 14–15 & 30
const AI_QUESTION_TEMPLATES: {
  key: string;
  category: string;
  title: string;
  type: "text" | "number" | "color" | "image";
  options: { label: string; media_url: string }[];
}[] = [
  {
    key: "Gifts",
    category: "Gifts",
    title: "Select a birthday gift item that you think other players will select",
    type: "text",
    options: [
      { label: "Cash Transfer", media_url: "" },
      { label: "Perfume", media_url: "" },
      { label: "Smartphone", media_url: "" },
      { label: "Wristwatch", media_url: "" },
      { label: "Cake & Wine", media_url: "" },
      { label: "Sneakers", media_url: "" },
      { label: "Jewellery", media_url: "" },
      { label: "Designer Bag", media_url: "" },
      { label: "Dinner Date", media_url: "" },
      { label: "Gift Voucher", media_url: "" },
    ],
  },
  {
    key: "Bathing Soap",
    category: "Bathing Soap",
    title: "Select a bathing soap brand that you think other players will select",
    type: "text",
    options: [
      { label: "Dettol", media_url: "" },
      { label: "Lux", media_url: "" },
      { label: "Premier Cool", media_url: "" },
      { label: "Imperial Leather", media_url: "" },
      { label: "Delta Soap", media_url: "" },
      { label: "Safeguard", media_url: "" },
      { label: "Dove", media_url: "" },
      { label: "Eva Soap", media_url: "" },
      { label: "Joy Soap", media_url: "" },
      { label: "Tetmosol", media_url: "" },
    ],
  },
  {
    key: "Breakfast",
    category: "Breakfast",
    title: "Select a Nigerian breakfast meal that you think other players will select",
    type: "text",
    options: [
      { label: "Bread & Akara", media_url: "" },
      { label: "Bread & Fried Egg", media_url: "" },
      { label: "Pap (Akamu) & Moi-Moi", media_url: "" },
      { label: "Indomie & Egg", media_url: "" },
      { label: "Yam & Egg Sauce", media_url: "" },
      { label: "Tea & Bread", media_url: "" },
      { label: "Custard & Akara", media_url: "" },
      { label: "Plantain & Egg", media_url: "" },
      { label: "Golden Morn", media_url: "" },
      { label: "Cornflakes", media_url: "" },
    ],
  },
  {
    key: "Beverage",
    category: "Beverage",
    title: "Select a beverage brand that you think other players will select",
    type: "text",
    options: [
      { label: "Milo", media_url: "" },
      { label: "Bournvita", media_url: "" },
      { label: "Ovaltine", media_url: "" },
      { label: "Peak Milk", media_url: "" },
      { label: "Cowbell", media_url: "" },
      { label: "Three Crowns", media_url: "" },
      { label: "Lipton Yellow Label", media_url: "" },
      { label: "Nescafé", media_url: "" },
      { label: "Dano Milk", media_url: "" },
      { label: "Hollandia Evap", media_url: "" },
    ],
  },
  {
    key: "Toothpaste",
    category: "Toothpaste",
    title: "Select a toothpaste brand that you think other players will select",
    type: "text",
    options: [
      { label: "Close Up", media_url: "" },
      { label: "Oral-B", media_url: "" },
      { label: "Colgate", media_url: "" },
      { label: "Sensodyne", media_url: "" },
      { label: "Pepsodent", media_url: "" },
      { label: "Macleans", media_url: "" },
      { label: "Dabur Herbal", media_url: "" },
      { label: "Olive Flouride", media_url: "" },
      { label: "Aquafresh", media_url: "" },
      { label: "Minta", media_url: "" },
    ],
  },
  {
    key: "Clothing Brands",
    category: "Clothing Brands",
    title: "Select a clothing & sportswear brand that you think other players will select",
    type: "text",
    options: [
      { label: "Nike", media_url: "" },
      { label: "Adidas", media_url: "" },
      { label: "Zara", media_url: "" },
      { label: "Gucci", media_url: "" },
      { label: "Puma", media_url: "" },
      { label: "Louis Vuitton", media_url: "" },
      { label: "H&M", media_url: "" },
      { label: "Balenciaga", media_url: "" },
      { label: "Tommy Hilfiger", media_url: "" },
      { label: "Calvin Klein", media_url: "" },
    ],
  },
  {
    key: "Football Club",
    category: "Football Club",
    title: "Select a football club that you think other players will select",
    type: "text",
    options: [
      { label: "Chelsea", media_url: "" },
      { label: "Arsenal", media_url: "" },
      { label: "Manchester United", media_url: "" },
      { label: "Real Madrid", media_url: "" },
      { label: "Barcelona", media_url: "" },
      { label: "Manchester City", media_url: "" },
      { label: "Liverpool", media_url: "" },
      { label: "Bayern Munich", media_url: "" },
      { label: "PSG", media_url: "" },
      { label: "AC Milan", media_url: "" },
    ],
  },
  {
    key: "Sports",
    category: "Sports",
    title: "Select a sport that you think other players will select",
    type: "text",
    options: [
      { label: "Football", media_url: "" },
      { label: "Basketball", media_url: "" },
      { label: "Athletics (Track)", media_url: "" },
      { label: "Boxing", media_url: "" },
      { label: "Tennis", media_url: "" },
      { label: "Table Tennis", media_url: "" },
      { label: "Swimming", media_url: "" },
      { label: "Volleyball", media_url: "" },
      { label: "Formula 1", media_url: "" },
      { label: "Wrestling", media_url: "" },
    ],
  },
  {
    key: "Soft Drinks",
    category: "Soft Drinks",
    title: "Select a soft drink that you think other players will select",
    type: "text",
    options: [
      { label: "Coca-Cola", media_url: "" },
      { label: "Pepsi", media_url: "" },
      { label: "Fanta", media_url: "" },
      { label: "Sprite", media_url: "" },
      { label: "Maltina", media_url: "" },
      { label: "Bigi Cola", media_url: "" },
      { label: "7Up", media_url: "" },
      { label: "Amstel Malta", media_url: "" },
      { label: "Schweppes", media_url: "" },
      { label: "La Casera", media_url: "" },
    ],
  },
  {
    key: "Swallow",
    category: "Swallow",
    title: "Select a Nigerian swallow meal that you think other players will select",
    type: "text",
    options: [
      { label: "Pounded Yam", media_url: "" },
      { label: "Eba (Garri)", media_url: "" },
      { label: "Amala", media_url: "" },
      { label: "Semovita", media_url: "" },
      { label: "Fufu (Akpu)", media_url: "" },
      { label: "Wheat", media_url: "" },
      { label: "Tuwo Shinkafa", media_url: "" },
      { label: "Poundo Potato", media_url: "" },
      { label: "Oat Meal Swallow", media_url: "" },
      { label: "Plantain Fufu", media_url: "" },
    ],
  },
  {
    key: "Hangout",
    category: "Hangout",
    title: "Select a hangout spot that you think other players will select",
    type: "text",
    options: [
      { label: "Eatery", media_url: "" },
      { label: "Cinema", media_url: "" },
      { label: "Beach", media_url: "" },
      { label: "Lounge", media_url: "" },
      { label: "Night Club", media_url: "" },
      { label: "Shopping Mall", media_url: "" },
      { label: "Amusement Park", media_url: "" },
      { label: "Karaoke Bar", media_url: "" },
      { label: "Game Arcade", media_url: "" },
      { label: "Poolside", media_url: "" },
    ],
  },
  {
    key: "Country to Visit",
    category: "Country to Visit",
    title: "Select a country to visit that you think other players will select",
    type: "text",
    options: [
      { label: "USA", media_url: "" },
      { label: "UK", media_url: "" },
      { label: "Canada", media_url: "" },
      { label: "UAE (Dubai)", media_url: "" },
      { label: "France", media_url: "" },
      { label: "South Africa", media_url: "" },
      { label: "Qatar", media_url: "" },
      { label: "Spain", media_url: "" },
      { label: "Italy", media_url: "" },
      { label: "Maldives", media_url: "" },
    ],
  },
  {
    key: "Romantic Gesture",
    category: "Romantic Gesture",
    title: "Select a romantic gesture that you think other players will select",
    type: "text",
    options: [
      { label: "Credit Alert", media_url: "" },
      { label: "Surprise Gift", media_url: "" },
      { label: "Dinner Date", media_url: "" },
      { label: "Weekend Getaway", media_url: "" },
      { label: "Shopping Spree", media_url: "" },
      { label: "Forehead Kiss", media_url: "" },
      { label: "Love Text", media_url: "" },
      { label: "Breakfast in Bed", media_url: "" },
      { label: "Flowers & Chocolate", media_url: "" },
      { label: "Warm Hug", media_url: "" },
    ],
  },
  {
    key: "Snacks",
    category: "Snacks",
    title: "Select a snack that you think other players will select",
    type: "text",
    options: [
      { label: "Meat Pie", media_url: "" },
      { label: "Shawarma", media_url: "" },
      { label: "Gala (Sausage Roll)", media_url: "" },
      { label: "Puff-Puff", media_url: "" },
      { label: "Chin-Chin", media_url: "" },
      { label: "Egg Roll", media_url: "" },
      { label: "Doughnut", media_url: "" },
      { label: "Plantain Chips", media_url: "" },
      { label: "Popcorn", media_url: "" },
      { label: "Scotch Egg", media_url: "" },
    ],
  },
  {
    key: "Protein",
    category: "Protein",
    title: "Select a meal protein that you think other players will select",
    type: "text",
    options: [
      { label: "Chicken", media_url: "" },
      { label: "Turkey", media_url: "" },
      { label: "Goat Meat (Asun)", media_url: "" },
      { label: "Beef", media_url: "" },
      { label: "Catfish", media_url: "" },
      { label: "Titus Fish", media_url: "" },
      { label: "Assorted (Shaki)", media_url: "" },
      { label: "Ponmo", media_url: "" },
      { label: "Boiled Egg", media_url: "" },
      { label: "Snail", media_url: "" },
    ],
  },
];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  // Create form state (10 options per Product Doc)
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [qType, setQType] = useState<"text" | "number" | "color" | "image">("text");
  const [createStatus, setCreateStatus] = useState<"published" | "draft">("published");
  const [assignSessionId, setAssignSessionId] = useState<string>("all");
  const [options, setOptions] = useState<{ label: string; media_url: string }[]>(
    Array.from({ length: 10 }, () => ({ label: "", media_url: "" }))
  );
  const [creating, setCreating] = useState(false);

  // Edit Modal state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState<"text" | "number" | "color" | "image">("text");
  const [editStatus, setEditStatus] = useState<string>("published");
  const [editOptions, setEditOptions] = useState<
    { id?: string; label: string; media_url: string }[]
  >([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Preview Modal state (5x2 player grid preview)
  const [previewQuestion, setPreviewQuestion] = useState<{
    title: string;
    category: string;
    type: "text" | "number" | "color" | "image";
    options: { label: string; media_url?: string | null }[];
  } | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/questions?sessionId=${encodeURIComponent(selectedSessionId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const list = (data.questions ?? []) as Question[];
      setQuestions(list);
      if (data.sessions) {
        setSessions(data.sessions as SessionSummary[]);
      }
      if (list.length > 0) {
        setSelectedQuestionId((prev) =>
          prev && list.some((q) => q.id === prev) ? prev : list[0].id
        );
      } else {
        setSelectedQuestionId(null);
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleTypeChange = (nextType: "text" | "number" | "color" | "image") => {
    setQType(nextType);
    if (nextType === "number") {
      setOptions(
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((n) => ({
          label: n,
          media_url: "",
        }))
      );
    } else if (nextType === "color") {
      setOptions(DEFAULT_COLOR_OPTIONS.map((c) => ({ ...c })));
    } else {
      setOptions(Array.from({ length: 10 }, () => ({ label: "", media_url: "" })));
    }
  };

  const applyAITemplateToForm = (tpl: (typeof AI_QUESTION_TEMPLATES)[number]) => {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setQType(tpl.type);
    setOptions(tpl.options.map((o) => ({ ...o })));
    setShowAIGenerator(false);
    setShowCreate(true);
    showToastMsg(`Loaded "${tpl.key}" 10-option template into creator!`);
  };

  const quickPublishAITemplate = async (tpl: (typeof AI_QUESTION_TEMPLATES)[number]) => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tpl.title,
          category: tpl.category,
          type: tpl.type,
          status: "published",
          options: tpl.options,
          assignToSessionId: selectedSessionId !== "all" ? selectedSessionId : undefined,
        }),
      });
      if (res.ok) {
        showToastMsg(`Published "${tpl.key}" 10-option question to Question Bank!`);
        await loadQuestions();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOpts = options.filter((o) => o.label.trim());
    if (!title.trim() || validOpts.length < 2) return;
    setCreating(true);

    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          type: qType,
          status: createStatus,
          options: validOpts,
          assignToSessionId:
            assignSessionId !== "all"
              ? assignSessionId
              : selectedSessionId !== "all"
              ? selectedSessionId
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create question");
      } else {
        setTitle("");
        setOptions(Array.from({ length: 10 }, () => ({ label: "", media_url: "" })));
        setShowCreate(false);
        showToastMsg("Question saved to Question Bank!");
        await loadQuestions();
      }
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setEditTitle(q.title);
    setEditCategory(q.category);
    setEditType(q.type);
    setEditStatus(q.status);
    const padded = Array.from({ length: 10 }, (_, idx) => {
      const existing = q.question_options?.[idx];
      return {
        id: existing?.id,
        label: existing?.label ?? "",
        media_url: existing?.media_url ?? "",
      };
    });
    setEditOptions(padded);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingQuestion.id,
          title: editTitle,
          category: editCategory,
          type: editType,
          status: editStatus,
          options: editOptions.filter((o) => o.label.trim()),
        }),
      });
      if (res.ok) {
        setEditingQuestion(null);
        showToastMsg("Question & 10 options updated!");
        await loadQuestions();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to update question");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    showToastMsg(`Question status changed to ${status.toUpperCase()}`);
    await loadQuestions();
  };

  const handleDeleteQuestion = async (q: Question) => {
    if (
      !window.confirm(
        `Delete question "${q.title}" and its 10 options? This action cannot be undone.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/questions?id=${encodeURIComponent(q.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToastMsg("Question deleted from Question Bank.");
      await loadQuestions();
    }
  };

  // Session-to-Session navigation helpers
  const sessionIds = ["all", ...sessions.map((s) => s.id)];
  const currentSessionIdx = sessionIds.indexOf(selectedSessionId);
  const goPrevSession = () => {
    if (currentSessionIdx > 0) setSelectedSessionId(sessionIds[currentSessionIdx - 1]);
  };
  const goNextSession = () => {
    if (currentSessionIdx < sessionIds.length - 1)
      setSelectedSessionId(sessionIds[currentSessionIdx + 1]);
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter !== "all" && q.status !== filter) return false;
    if (search) {
      return (
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.category.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  const selectedQuestion =
    questions.find((q) => q.id === selectedQuestionId) ?? filteredQuestions[0] ?? null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
            Pages 14–15, 30, 34, 36 · Question Bank &amp; Session Questions
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Question Management &amp; AI Question Bank
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, edit, preview, and publish 10-option crowd questions across Text, Number, Colour, and Image formats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setShowAIGenerator(!showAIGenerator);
              setShowCreate(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 font-bold text-xs sm:text-sm transition-all"
          >
            <span>✦ AI Question Bank Generator (15 Templates)</span>
          </button>
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              setShowAIGenerator(false);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-all"
          >
            <span>{showCreate ? "Close Creator" : "+ Create 10-Option Question"}</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-2xl px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          ✓ {toast}
        </div>
      )}

      {/* Architecture Explanation Banner: Standalone Question Bank vs. 10 Questions per Session */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
            How Guess What Questions Work (Standalone Bank vs. 10-Question Sessions)
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every question lives in the central <strong>Question Bank</strong> with <strong>10 options</strong> (laid out in a 5×2 player grid). Game Sessions pull a set of <strong>10 questions (Q1–Q10)</strong> from this bank. Switch below between the <strong>Standalone Question Bank (All Sessions)</strong> and any individual <strong>Game Session&apos;s 10 Assigned Questions</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Bank Total</p>
            <p className="text-base font-black text-white">{questions.length}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Per Session</p>
            <p className="text-base font-black text-amber-400">10 Qs</p>
          </div>
        </div>
      </div>

      {/* Session-to-Session Navigator */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Session Scope &amp; Session-to-Session Navigator:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevSession}
              disabled={currentSessionIdx <= 0}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              ◀ Prev Session
            </button>
            <button
              onClick={goNextSession}
              disabled={currentSessionIdx >= sessionIds.length - 1}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              Next Session ▶
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedSessionId("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
              selectedSessionId === "all"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/10"
            }`}
          >
            All Sessions (Standalone Question Bank)
          </button>
          {sessions.map((s) => {
            const active = selectedSessionId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 ${
                  active
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                <span>{s.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    active ? "bg-black/30 text-amber-300" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {s.question_count}/10 Qs · {s.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Question Bank Generator Panel (Pages 14–15 & 30 Templates) */}
      {showAIGenerator && (
        <div className="wimbf-glass rounded-3xl p-6 md:p-8 border border-indigo-500/40 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                Pages 14–15 &amp; 30 · Curated Crowd Question Bank
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">
                AI 10-Option Question Bank Generator
              </h2>
              <p className="text-xs text-slate-400">
                Select any of the 15 official Guess What categories below to customize its 10 crowd options or 1-click publish directly to the Question Bank.
              </p>
            </div>
            <button
              onClick={() => setShowAIGenerator(false)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
            >
              Close Generator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AI_QUESTION_TEMPLATES.map((tpl) => (
              <div
                key={tpl.key}
                className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 hover:border-indigo-500/40 flex flex-col justify-between gap-3 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold uppercase">
                      {tpl.key}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">10 Options</span>
                  </div>
                  <p className="text-xs font-bold text-white leading-snug">{tpl.title}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tpl.options.map((o, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/5 text-[10px] text-slate-300"
                      >
                        {idx + 1}. {o.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => applyAITemplateToForm(tpl)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs transition-colors"
                  >
                    Customize in Editor
                  </button>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => quickPublishAITemplate(tpl)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    + Publish Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Question Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="wimbf-glass rounded-3xl p-6 md:p-8 space-y-6 border border-amber-500/30 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Create 10-Option Question</h2>
              <p className="text-xs text-slate-400">
                Supports Text (10 words), Number (0–9), Colour (10 hex circles), and Image (10 medium photos)
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setPreviewQuestion({
                  title: title || "Select an option that you think other players will select",
                  category,
                  type: qType,
                  options,
                })
              }
              className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold"
            >
              👁 Preview 5×2 Player Grid
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Question Prompt
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="e.g., Select a hangout spot that you think other players will select"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Format
              </label>
              <select
                value={qType}
                onChange={(e) =>
                  handleTypeChange(e.target.value as "text" | "number" | "color" | "image")
                }
                className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="text">Text (10 words)</option>
                <option value="number">Number (0–9)</option>
                <option value="color">Colour (10 circles)</option>
                <option value="image">Image (10 photos)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Publish Status
              </label>
              <select
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value as "published" | "draft")}
                className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs font-semibold text-white"
              >
                <option value="published">Published (Ready for Game Sessions)</option>
                <option value="draft">Draft (Unpublished)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Assign to Game Session (Optional)
              </label>
              <select
                value={assignSessionId}
                onChange={(e) => setAssignSessionId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs font-semibold text-white"
              >
                <option value="all">Question Bank Only (Assign Later)</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.question_count}/10 Qs)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              10 Options{" "}
              {qType === "color"
                ? "(Label + Hex Code)"
                : qType === "image"
                ? "(Label + Image URL)"
                : ""}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...next[i], label: e.target.value };
                      setOptions(next);
                    }}
                    placeholder={`Option ${i + 1} label`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                  {(qType === "color" || qType === "image") && (
                    <input
                      value={opt.media_url}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], media_url: e.target.value };
                        setOptions(next);
                      }}
                      placeholder={qType === "color" ? "#FF1100" : "https://..."}
                      className="w-36 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
            >
              {creating
                ? "Saving..."
                : createStatus === "published"
                ? "Publish Question"
                : "Save as Draft"}
            </button>
            <button
              type="button"
              onClick={() =>
                setPreviewQuestion({
                  title: title || "Select an option that you think other players will select",
                  category,
                  type: qType,
                  options,
                })
              }
              className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-sm"
            >
              Preview Question
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Real-Time Guesses & Ascribed Points Chart (Product Document Page 32 & 34) */}
      {selectedQuestion && (
        <div className="wimbf-glass rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedQuestion.session_position && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-black">
                    Session Q{selectedQuestion.session_position} of 10
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase">
                  {selectedQuestion.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 text-xs font-semibold uppercase">
                  Format: {selectedQuestion.type}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold">
                  Used in {selectedQuestion.sessions_used_count ?? 0} session(s)
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-2">
                {selectedQuestion.title}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setPreviewQuestion({
                    title: selectedQuestion.title,
                    category: selectedQuestion.category,
                    type: selectedQuestion.type,
                    options: selectedQuestion.question_options ?? [],
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs font-bold"
              >
                👁 Preview 5×2 Grid
              </button>
              <button
                onClick={() => openEditModal(selectedQuestion)}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold"
              >
                ✎ Edit Question
              </button>
              <div className="text-right pl-2">
                <p className="text-xs uppercase tracking-wider text-slate-400">Total Guesses</p>
                <p className="text-2xl font-black text-amber-400">
                  {(selectedQuestion.total_guesses ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Horizontal Bar Chart of 10 Options with Live Points (10 pts down to 1 pt) */}
          <div className="space-y-3">
            {(() => {
              const opts = selectedQuestion.question_options ?? [];
              const maxGuesses = Math.max(...opts.map((o) => o.guesses ?? 0), 1);

              return opts.map((opt) => {
                const guesses = opt.guesses ?? 0;
                const pct = opt.percentage ?? 0;
                const avgSec = opt.avg_response_ms
                  ? `${(opt.avg_response_ms / 1000).toFixed(1)}s`
                  : "—";
                const pts = opt.points ?? 1;
                const widthPct = Math.max(Math.round((guesses / maxGuesses) * 100), 4);
                const isTop = pts === 10;
                const isBottom = pts === 1;

                return (
                  <div key={opt.id} className="grid grid-cols-12 items-center gap-3 text-sm">
                    <div className="col-span-3 sm:col-span-2 flex items-center gap-2 truncate font-semibold text-slate-200">
                      {selectedQuestion.type === "color" && opt.media_url && (
                        <span
                          className="size-3.5 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: opt.media_url }}
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    <div className="col-span-6 sm:col-span-7 flex items-center gap-3">
                      <div className="flex-1 h-6 rounded-lg bg-white/5 overflow-hidden flex items-center">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isTop
                              ? "bg-emerald-500"
                              : isBottom
                              ? "bg-[#F7911B]"
                              : "bg-sky-500/80"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-28 text-right font-mono text-xs text-slate-300 shrink-0">
                        {guesses.toLocaleString()} ({pct}%) · {avgSec}
                      </span>
                    </div>

                    <div className="col-span-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                          isTop
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : isBottom
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-white/5 text-slate-300"
                        }`}
                      >
                        {isTop ? "★ " : isBottom ? "▼ " : ""}
                        {pts} {pts === 1 ? "point" : "points"}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="wimbf-glass rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider ${
                filter === s
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/[0.02] text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by question prompt or category..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Questions Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading question bank...</p>
        </div>
      ) : (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-4">Question</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4">Format</th>
                  <th className="px-4 py-4">Sessions Used</th>
                  <th className="px-4 py-4">Total Guesses</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQuestions.map((q) => {
                  const isSelected = selectedQuestion?.id === q.id;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedQuestionId(q.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-amber-500/10" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-5 py-4 font-semibold text-white max-w-md">
                        <div className="flex items-center gap-2">
                          {q.session_position && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[11px] font-black shrink-0">
                              Q{q.session_position}
                            </span>
                          )}
                          <span className="truncate">{q.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {q.question_options?.length ?? 0} options configured
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-300">{q.category}</td>
                      <td className="px-4 py-4 text-xs uppercase font-bold text-amber-400">
                        {q.type}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-200 font-semibold">
                          {q.sessions_used_count ?? 0} session(s)
                        </span>
                        {q.assigned_sessions && q.assigned_sessions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.assigned_sessions.slice(0, 2).map((as) => (
                              <span
                                key={`${as.session_id}_${as.position}`}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300"
                              >
                                {as.session_name} (#{as.position})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-emerald-400 font-bold">
                        {(q.total_guesses ?? 0).toLocaleString()}
                      </td>
                      <td
                        className="px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={q.status}
                          onChange={(e) => updateStatus(q.id, e.target.value)}
                          className="rounded-xl border border-white/10 bg-[#0e121b] text-xs font-semibold px-2.5 py-1.5 text-slate-200"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="px-5 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setPreviewQuestion({
                                title: q.title,
                                category: q.category,
                                type: q.type,
                                options: q.question_options ?? [],
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => openEditModal(q)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#0f1219] border border-white/15 p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  Edit Question &amp; 10 Options
                </h2>
                <p className="text-xs text-slate-400">
                  Update prompt, category, format, status, or any of the 10 options
                </p>
              </div>
              <button
                onClick={() => setEditingQuestion(null)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Question Prompt
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Format
                  </label>
                  <select
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value as "text" | "number" | "color" | "image")
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs text-white"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="color">Colour</option>
                    <option value="image">Image</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs text-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  10 Options
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {editOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="size-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        value={opt.label}
                        onChange={(e) => {
                          const next = [...editOptions];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setEditOptions(next);
                        }}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white"
                      />
                      {(editType === "color" || editType === "image") && (
                        <input
                          value={opt.media_url}
                          onChange={(e) => {
                            const next = [...editOptions];
                            next[idx] = { ...next[idx], media_url: e.target.value };
                            setEditOptions(next);
                          }}
                          placeholder={editType === "color" ? "#FF1100" : "https://..."}
                          className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5x2 Player Grid Preview Modal (Page 36 Requirement: Preview Question Before/After Publishing) */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-[#140d26] border border-amber-500/40 p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase">
                  Player Gameplay Preview · {previewQuestion.category}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-semibold uppercase">
                  5×2 Grid ({previewQuestion.type})
                </span>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                ✕ Close Preview
              </button>
            </div>

            <div className="text-center space-y-2 py-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Guess What Other Players Will Select
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {previewQuestion.title}
              </h3>
            </div>

            {/* 5x2 Grid Representation matching Pages 5–9 of Product Document */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {previewQuestion.options.slice(0, 10).map((opt, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-4 bg-white/[0.06] hover:bg-amber-500/20 border border-white/15 hover:border-amber-400 transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer min-h-[92px]"
                >
                  {previewQuestion.type === "color" && (
                    <span
                      className="size-10 rounded-full border-2 border-white/30 shadow-md"
                      style={{ backgroundColor: opt.media_url || "#F59E0B" }}
                    />
                  )}
                  {previewQuestion.type === "number" ? (
                    <span className="text-3xl font-black text-amber-400">
                      {opt.label || idx}
                    </span>
                  ) : (
                    <span className="text-xs sm:text-sm font-bold text-white leading-tight">
                      {opt.label || `Option ${idx + 1}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
              <span>10 Options · Points awarded dynamically from 10 pts (#1) down to 1 pt (#10)</span>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
