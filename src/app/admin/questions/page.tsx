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
  notes?: string | null;
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
  "Food",
  "Cars",
  "Fruits",
  "Snacks",
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
  "Country to Visit",
  "Romantic Gesture",
  "Social Media",
  "Drinks",
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

function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/") || url.startsWith("blob:");
}

function formatFilenameToLabel(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 24);
}

const OPTION_TEMPLATE_SIZE_PX = 800;

/**
 * Normalize every 10-option picture upload into the standardized 800 x 800 px (1:1 Square)
 * template via centered cover-crop + WebP compression (with JPEG fallback).
 */
async function normalizeSquareOptionImage(
  file: File,
  targetSize = OPTION_TEMPLATE_SIZE_PX,
  quality = 0.86
): Promise<Blob> {
  if (typeof window === "undefined" || file.type === "image/gif") {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const side = Math.max(1, Math.min(img.width, img.height));
      const sx = Math.round((img.width - side) / 2);
      const sy = Math.round((img.height - side) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve(webpBlob);
            return;
          }
          canvas.toBlob(
            (jpegBlob) => resolve(jpegBlob || file),
            "image/jpeg",
            quality
          );
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

/**
 * Compress optional Question Header Banner while preserving its natural aspect ratio.
 */
async function compressBannerImage(
  file: File,
  maxWidth = 1200,
  quality = 0.85
): Promise<Blob> {
  if (typeof window === "undefined" || file.type === "image/gif") {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve(webpBlob);
            return;
          }
          canvas.toBlob(
            (jpegBlob) => resolve(jpegBlob || file),
            "image/jpeg",
            quality
          );
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

async function uploadImageToStorage(
  file: File,
  extra?: { optionId?: string; questionId?: string; mode?: "option" | "banner" }
): Promise<string> {
  const mode = extra?.mode ?? "option";
  const processed =
    mode === "banner"
      ? await compressBannerImage(file)
      : await normalizeSquareOptionImage(file);
  const mimeType = processed.type || file.type || "image/webp";
  const ext = mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
  const baseName = (file.name || "option").replace(/\.[^/.]+$/, "");
  const formData = new FormData();
  const safeFile = new File([processed], `${baseName}.${ext}`, {
    type: mimeType,
  });
  formData.append("file", safeFile);
  if (extra?.optionId) formData.append("optionId", extra.optionId);
  if (extra?.questionId) formData.append("questionId", extra.questionId);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Image upload failed");
  }
  return data.url as string;
}

// Curated 10-option Nigerian & Global Crowd Templates (Picture + Text Templates from Product Doc Pages 11 to 15 & 30)
const AI_QUESTION_TEMPLATES: {
  key: string;
  category: string;
  title: string;
  type: "text" | "number" | "color" | "image";
  options: { label: string; media_url: string }[];
}[] = [
  {
    key: "Picture: Nigerian Food (Page 11)",
    category: "Food",
    title: "Which food will be selected the most?",
    type: "image",
    options: [
      { label: "Jollof Rice", media_url: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Egusi & Pounded Yam", media_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Amala & Ewedu", media_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Okra & Eba", media_url: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Abula", media_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Ofada Rice", media_url: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Edikang Ikong", media_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Rice & Stew", media_url: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Beans & Plantain", media_url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Bole & Fish", media_url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&h=800&q=80" },
    ],
  },
  {
    key: "Picture: Cars Most Selected (Page 12)",
    category: "Cars",
    title: "Which car will be selected the most?",
    type: "image",
    options: [
      { label: "Range Rover", media_url: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Bugatti", media_url: "https://images.unsplash.com/photo-1566008885218-90abf9200ddb?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Tesla", media_url: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "BMW", media_url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Mustang", media_url: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "G-Wagon", media_url: "https://images.unsplash.com/photo-1520031441872-265e4ff70366?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Rolls-Royce", media_url: "https://images.unsplash.com/photo-1631295868223-63265b40d9e4?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Ferrari", media_url: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Lamborghini", media_url: "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "McLaren", media_url: "https://images.unsplash.com/photo-1621135802920-133df287f89c?auto=format&fit=crop&w=800&h=800&q=80" },
    ],
  },
  {
    key: "Picture: Cars Least Selected (Page 13)",
    category: "Cars",
    title: "Which car will be selected the least?",
    type: "image",
    options: [
      { label: "Range Rover", media_url: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Bugatti", media_url: "https://images.unsplash.com/photo-1566008885218-90abf9200ddb?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Tesla", media_url: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "BMW", media_url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Mustang", media_url: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "G-Wagon", media_url: "https://images.unsplash.com/photo-1520031441872-265e4ff70366?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Rolls-Royce", media_url: "https://images.unsplash.com/photo-1631295868223-63265b40d9e4?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Ferrari", media_url: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Lamborghini", media_url: "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "McLaren", media_url: "https://images.unsplash.com/photo-1621135802920-133df287f89c?auto=format&fit=crop&w=800&h=800&q=80" },
    ],
  },
  {
    key: "Picture: Fruits (Page 14)",
    category: "Fruits",
    title: "Which fruit will be selected the most?",
    type: "image",
    options: [
      { label: "Banana", media_url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Mango", media_url: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Pawpaw", media_url: "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Orange", media_url: "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Pear", media_url: "https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Apple", media_url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Pineapple", media_url: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Coconut", media_url: "https://images.unsplash.com/photo-1580984969071-a8da5656c2fb?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Watermelon", media_url: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Tangerine", media_url: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=800&h=800&q=80" },
    ],
  },
  {
    key: "Picture: Snacks (Page 14)",
    category: "Snacks",
    title: "Which snack will be selected the most?",
    type: "image",
    options: [
      { label: "Suya", media_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Kilishi", media_url: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Pizza", media_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Small Chops", media_url: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Popcorn", media_url: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Fried Yam", media_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Plantain Chips", media_url: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Cashew Nuts", media_url: "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Groundnut", media_url: "https://images.unsplash.com/photo-1567892737950-30c4db37cd89?auto=format&fit=crop&w=800&h=800&q=80" },
      { label: "Meat Pie", media_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&h=800&q=80" },
    ],
  },
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
];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "text" | "color" | "number">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  // Upload loading state keyed by slot identifier (e.g. "create-0", "edit-2", "inline-optId")
  const [uploadingSlot, setUploadingSlot] = useState<Record<string, boolean>>({});

  // Create form state (10 options per Product Doc)
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [qType, setQType] = useState<"text" | "number" | "color" | "image">("image");
  const [createStatus, setCreateStatus] = useState<"published" | "draft">("published");
  const [assignSessionId, setAssignSessionId] = useState<string>("all");
  const [questionBannerUrl, setQuestionBannerUrl] = useState<string>("");
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
  const [editBannerUrl, setEditBannerUrl] = useState<string>("");
  const [editOptions, setEditOptions] = useState<
    { id?: string; label: string; media_url: string }[]
  >([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // In-app Delete Confirmation Modal state (replaces window.confirm which can be blocked)
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview Modal state (5x2 player grid preview)
  const [previewQuestion, setPreviewQuestion] = useState<{
    title: string;
    category: string;
    type: "text" | "number" | "color" | "image";
    notes?: string | null;
    options: { label: string; media_url?: string | null }[];
  } | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
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
      setOptions((prev) =>
        prev.map((o) => ({
          label: o.label,
          media_url: o.media_url.startsWith("#") ? "" : o.media_url,
        }))
      );
    }
  };

  // Direct file upload for Create Option slot
  const handleCreateOptionFileUpload = async (idx: number, file: File | null) => {
    if (!file) return;
    const slotKey = `create-${idx}`;
    setUploadingSlot((p) => ({ ...p, [slotKey]: true }));
    if (qType === "text") setQType("image");
    try {
      const uploadedUrl = await uploadImageToStorage(file);
      setOptions((prev) => {
        const next = [...prev];
        const autoLabel = next[idx].label.trim() || formatFilenameToLabel(file.name);
        next[idx] = { label: autoLabel, media_url: uploadedUrl };
        return next;
      });
      showToastMsg(`Uploaded picture for Option ${idx + 1}!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setUploadingSlot((p) => ({ ...p, [slotKey]: false }));
    }
  };

  // Bulk upload up to 10 pictures at once for Create Form
  const handleCreateBulkFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setQType("image");
    const files = Array.from(fileList).slice(0, 10);
    setUploadingSlot((p) => ({ ...p, "create-bulk": true }));
    try {
      const uploaded = await Promise.all(
        files.map(async (f) => ({
          url: await uploadImageToStorage(f),
          name: formatFilenameToLabel(f.name),
        }))
      );
      setOptions((prev) => {
        const next = [...prev];
        uploaded.forEach((item, idx) => {
          if (idx < 10) {
            next[idx] = {
              label: next[idx].label.trim() || item.name || `Option ${idx + 1}`,
              media_url: item.url,
            };
          }
        });
        return next;
      });
      showToastMsg(`Uploaded ${uploaded.length} picture(s) directly to Options!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to bulk upload pictures");
    } finally {
      setUploadingSlot((p) => ({ ...p, "create-bulk": false }));
    }
  };

  // Direct file upload for Edit Modal Option slot
  const handleEditOptionFileUpload = async (idx: number, file: File | null) => {
    if (!file) return;
    const slotKey = `edit-${idx}`;
    setUploadingSlot((p) => ({ ...p, [slotKey]: true }));
    if (editType === "text") setEditType("image");
    try {
      const uploadedUrl = await uploadImageToStorage(file);
      setEditOptions((prev) => {
        const next = [...prev];
        const autoLabel = next[idx].label.trim() || formatFilenameToLabel(file.name);
        next[idx] = { ...next[idx], label: autoLabel, media_url: uploadedUrl };
        return next;
      });
      showToastMsg(`Uploaded picture for Option ${idx + 1}!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setUploadingSlot((p) => ({ ...p, [slotKey]: false }));
    }
  };

  // Bulk upload up to 10 pictures at once in Edit Modal
  const handleEditBulkFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setEditType("image");
    const files = Array.from(fileList).slice(0, 10);
    setUploadingSlot((p) => ({ ...p, "edit-bulk": true }));
    try {
      const uploaded = await Promise.all(
        files.map(async (f) => ({
          url: await uploadImageToStorage(f),
          name: formatFilenameToLabel(f.name),
        }))
      );
      setEditOptions((prev) => {
        const next = [...prev];
        uploaded.forEach((item, idx) => {
          if (idx < 10) {
            next[idx] = {
              ...next[idx],
              label: next[idx].label.trim() || item.name || `Option ${idx + 1}`,
              media_url: item.url,
            };
          }
        });
        return next;
      });
      showToastMsg(`Uploaded ${uploaded.length} picture(s) into question options!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload pictures");
    } finally {
      setUploadingSlot((p) => ({ ...p, "edit-bulk": false }));
    }
  };

  // Direct 1-click inline upload on an existing question option in the Selected Question Panel
  const handleInlineOptionUpload = async (
    questionId: string,
    optionId: string,
    optionLabel: string,
    file: File | null
  ) => {
    if (!file) return;
    const slotKey = `inline-${optionId}`;
    setUploadingSlot((p) => ({ ...p, [slotKey]: true }));
    try {
      await uploadImageToStorage(file, { optionId, questionId });
      showToastMsg(`Updated picture for "${optionLabel}"!`);
      await loadQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setUploadingSlot((p) => ({ ...p, [slotKey]: false }));
    }
  };

  // Question Banner / Prompt Picture Upload
  const handleBannerUpload = async (mode: "create" | "edit", file: File | null) => {
    if (!file) return;
    const slotKey = `banner-${mode}`;
    setUploadingSlot((p) => ({ ...p, [slotKey]: true }));
    try {
      const uploadedUrl = await uploadImageToStorage(file, { mode: "banner" });
      if (mode === "create") {
        setQuestionBannerUrl(uploadedUrl);
      } else {
        setEditBannerUrl(uploadedUrl);
      }
      showToastMsg("Uploaded Question Prompt Picture!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload question picture");
    } finally {
      setUploadingSlot((p) => ({ ...p, [slotKey]: false }));
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
          notes: questionBannerUrl || null,
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
        setQuestionBannerUrl("");
        setOptions(Array.from({ length: 10 }, () => ({ label: "", media_url: "" })));
        setShowCreate(false);
        showToastMsg("Question saved to Question Bank!");
        await loadQuestions();
      }
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (q: Question, forceImageMode = false) => {
    setEditingQuestion(q);
    setEditTitle(q.title);
    setEditCategory(q.category);
    setEditType(forceImageMode ? "image" : q.type);
    setEditStatus(q.status);
    setEditBannerUrl(isImageUrl(q.notes) ? q.notes || "" : "");
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
          notes: editBannerUrl || null,
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

  const handleDeleteQuestion = (q: Question) => {
    setQuestionToDelete(q);
  };

  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    const target = questionToDelete;
    setDeleting(true);
    try {
      let res = await fetch(`/api/admin/questions?id=${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        res = await fetch("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: target.id }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to delete question");
        return;
      }

      setQuestions((prev) => prev.filter((item) => item.id !== target.id));
      if (editingQuestion?.id === target.id) {
        setEditingQuestion(null);
      }
      setQuestionToDelete(null);
      showToastMsg(`Deleted question "${target.title}" from Question Bank.`);
      await loadQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete question");
    } finally {
      setDeleting(false);
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
    if (typeFilter !== "all" && q.type !== typeFilter) return false;
    if (search) {
      return (
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.category.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  const pictureQuestionCount = questions.filter((q) => q.type === "image").length;

  const selectedQuestion =
    questions.find((q) => q.id === selectedQuestionId) ?? filteredQuestions[0] ?? null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
            Pages 11 to 15, 26, 30, 34, 36 · Picture &amp; Text Question Bank
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Question Management &amp; Picture Question Studio
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, upload 1:1 square images (800 x 800 px), preview, and publish 10-option crowd questions across Picture, Text, Number, and Colour formats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setShowAIGenerator(!showAIGenerator);
              setShowCreate(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 font-bold text-xs sm:text-sm transition-all"
          >
            <span>✦ Question Bank Templates (Picture &amp; Text)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setQType("image");
              setShowCreate(true);
              setShowAIGenerator(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition-all"
          >
            <span>📷 + Create Picture Question</span>
          </button>
          <button
            type="button"
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
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
        >
          ✓ {toast}
        </div>
      )}

      {/* Architecture Explanation Banner */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Standardized 1:1 Square Picture Template (800 x 800 px)
            </p>
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
              Auto-Square Crop Enabled
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Option pictures render in a <strong>1:1 Square</strong> frame on both Mobile (2x5) and Desktop (5x2). Prepare option images at <strong>800 x 800 px</strong> (or any square size); non-square uploads are automatically center-cropped to <strong>800 x 800 px WebP</strong> on upload.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <p className="text-[10px] uppercase text-emerald-300 font-semibold">Template</p>
            <p className="text-base font-black text-emerald-400 font-mono">800×800</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Picture Qs</p>
            <p className="text-base font-black text-white">{pictureQuestionCount}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Bank Total</p>
            <p className="text-base font-black text-amber-400">{questions.length}</p>
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
              type="button"
              onClick={goPrevSession}
              disabled={currentSessionIdx <= 0}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              ◀ Prev Session
            </button>
            <button
              type="button"
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
            type="button"
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
                type="button"
                onClick={() => setSelectedSessionId(s.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 ${
                  active
                    ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/25"
                    : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                <span>{s.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    active ? "bg-black/25 text-white" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {s.question_count}/10 Qs · {s.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Question Bank Generator Panel (Picture + Text Templates) */}
      {showAIGenerator && (
        <div className="wimbf-glass rounded-3xl p-6 md:p-8 border border-sky-500/35 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                Pages 11 to 15 &amp; 30 · Picture &amp; Text Crowd Question Bank
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">
                10-Option Question Bank Templates (1:1 Square Picture Presets)
              </h2>
              <p className="text-xs text-slate-400">
                Select any Picture or Text template below to customize its 10 options (and upload your own 800 x 800 px photos) or 1-click publish to the Question Bank.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAIGenerator(false)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
            >
              Close Templates
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AI_QUESTION_TEMPLATES.map((tpl) => (
              <div
                key={tpl.key}
                className={`rounded-2xl p-4 bg-[#0f1219] border flex flex-col justify-between gap-3 transition-colors ${
                  tpl.type === "image"
                    ? "border-emerald-500/40 hover:border-emerald-400"
                    : "border-white/10 hover:border-sky-500/40"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        tpl.type === "image"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-sky-500/20 text-sky-300"
                      }`}
                    >
                      {tpl.type === "image" ? "🖼 " : ""}
                      {tpl.key}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {tpl.type === "image" ? "10 Photos · 1:1" : "10 Options"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white leading-snug">{tpl.title}</p>

                  {tpl.type === "image" ? (
                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      {tpl.options.map((o, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg overflow-hidden bg-slate-900 border border-white/10"
                          title={o.label}
                        >
                          <img
                            src={o.media_url}
                            alt={o.label}
                            width={80}
                            height={80}
                            loading="lazy"
                            className="w-full aspect-square object-cover object-center"
                          />
                          <p className="text-[9px] text-slate-300 truncate px-1 py-0.5 text-center">
                            {o.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => applyAITemplateToForm(tpl)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs transition-colors"
                  >
                    Customize / Upload Photos
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

      {/* Create Question Form with Direct Image Upload */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="wimbf-glass rounded-3xl p-6 md:p-8 space-y-6 border border-amber-500/30 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Create 10-Option Question (Direct Picture Upload Enabled)
              </h2>
              <p className="text-xs text-slate-400">
                Upload images directly from your device for Picture-based questions, or create Text, Number, and Colour questions.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setPreviewQuestion({
                  title: title || "Which option will be selected the most?",
                  category,
                  type: qType,
                  notes: questionBannerUrl || null,
                  options,
                })
              }
              className="px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 text-xs font-bold"
            >
              👁 Preview 5×2 Player Grid
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label
                htmlFor="create-question-prompt"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Question Prompt *
              </label>
              <input
                id="create-question-prompt"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="e.g., Which food will be selected the most?"
              />
            </div>

            <div>
              <label
                htmlFor="create-question-format"
                className="block text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-1.5"
              >
                Question Format
              </label>
              <select
                id="create-question-format"
                name="type"
                value={qType}
                onChange={(e) =>
                  handleTypeChange(e.target.value as "text" | "number" | "color" | "image")
                }
                className="w-full rounded-xl border border-emerald-500/40 bg-[#0e121b] px-3 py-3 text-sm font-bold text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="image">🖼 Picture (10 Square Options)</option>
                <option value="text">Aa Text (10 Words)</option>
                <option value="number">🔢 Number (0 to 9)</option>
                <option value="color">🎨 Colour (10 Circles)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="create-question-category"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Category
              </label>
              <select
                id="create-question-category"
                name="category"
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

          {/* Optional Question Header / Prompt Image Direct Upload */}
          <div className="rounded-2xl p-4 bg-[#0b0e14] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {questionBannerUrl ? (
                <img
                  src={questionBannerUrl}
                  alt="Question prompt preview"
                  width={96}
                  height={64}
                  className="w-20 h-14 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                />
              ) : (
                <div className="w-20 h-14 rounded-xl bg-white/[0.03] border border-dashed border-white/20 flex items-center justify-center text-xs text-slate-500 shrink-0">
                  No Banner
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-white">
                  Question Prompt Picture (Optional Header Photo)
                </p>
                <p className="text-[11px] text-slate-400">
                  Optionally attach a reference photo to the question prompt itself, or upload pictures for each of the 10 options below.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                id="create-banner-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleBannerUpload("create", e.target.files?.[0] ?? null)}
              />
              <label
                htmlFor="create-banner-upload"
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition-colors"
              >
                {uploadingSlot["banner-create"]
                  ? "Uploading..."
                  : questionBannerUrl
                  ? "↻ Change Question Photo"
                  : "📷 Upload Question Photo"}
              </label>
              {questionBannerUrl && (
                <button
                  type="button"
                  onClick={() => setQuestionBannerUrl("")}
                  className="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold"
                >
                  ✕ Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="create-publish-status"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Publish Status
              </label>
              <select
                id="create-publish-status"
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value as "published" | "draft")}
                className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs font-semibold text-white"
              >
                <option value="published">Published (Ready for Game Sessions)</option>
                <option value="draft">Draft (Unpublished)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="create-assign-session"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Assign to Game Session (Optional)
              </label>
              <select
                id="create-assign-session"
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

          {/* 10 Options with Direct Image Upload */}
          <fieldset className="space-y-3 border border-white/10 rounded-2xl p-4 bg-[#0b0e14]">
            <legend className="px-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              10 Answer Options{" "}
              {qType === "image"
                ? "(1:1 Square · 800 x 800 px Template)"
                : qType === "color"
                ? "(Label + Colour Picker)"
                : "(Click 📷 Upload Photo on any option to make it a Picture Question)"}
            </legend>

            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/10">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-300">
                  Recommended size: <strong className="text-emerald-300 font-mono">800 x 800 px (1:1 Square)</strong>. Non-square photos auto-crop to a centered 800 x 800 square.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="create-bulk-option-images"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleCreateBulkFilesUpload(e.target.files)}
                />
                <label
                  htmlFor="create-bulk-option-images"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-colors"
                >
                  <span>
                    {uploadingSlot["create-bulk"]
                      ? "Normalizing & Uploading..."
                      : "📁 Upload Up to 10 Square Option Pictures"}
                  </span>
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((opt, i) => {
                const isUploading = Boolean(uploadingSlot[`create-${i}`]);
                const hasImg = isImageUrl(opt.media_url);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/[0.02] border border-white/10"
                  >
                    <span className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                      {i + 1}
                    </span>

                    {/* Option Thumbnail Preview or Colour Swatch */}
                    {qType === "color" ? (
                      <input
                        type="color"
                        aria-label={`Option ${i + 1} colour`}
                        value={opt.media_url.startsWith("#") ? opt.media_url : "#F59E0B"}
                        onChange={(e) => {
                          const next = [...options];
                          next[i] = { ...next[i], media_url: e.target.value };
                          setOptions(next);
                        }}
                        className="size-10 rounded-lg border border-white/20 bg-transparent cursor-pointer shrink-0"
                      />
                    ) : hasImg ? (
                      <img
                        src={opt.media_url}
                        alt={opt.label || `Option ${i + 1}`}
                        width={96}
                        height={96}
                        className="size-12 aspect-square rounded-xl object-cover object-center border border-emerald-500/40 shrink-0 bg-slate-900"
                      />
                    ) : (
                      <div className="size-12 aspect-square rounded-xl bg-white/[0.03] border border-dashed border-white/15 flex items-center justify-center text-[10px] text-slate-500 text-center leading-tight shrink-0">
                        1:1
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <label htmlFor={`create-opt-label-${i}`} className="sr-only">
                        Option {i + 1} Label
                      </label>
                      <input
                        id={`create-opt-label-${i}`}
                        value={opt.label}
                        onChange={(e) => {
                          const next = [...options];
                          next[i] = { ...next[i], label: e.target.value };
                          setOptions(next);
                        }}
                        placeholder={`Option ${i + 1} label (e.g. Jollof Rice)`}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {qType !== "color" && qType !== "number" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          id={`create-opt-file-${i}`}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) =>
                            handleCreateOptionFileUpload(i, e.target.files?.[0] ?? null)
                          }
                        />
                        <label
                          htmlFor={`create-opt-file-${i}`}
                          className="cursor-pointer px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-colors"
                        >
                          {isUploading ? "..." : hasImg ? "↻ Photo" : "📷 Upload"}
                        </label>
                        {hasImg && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...options];
                              next[i] = { ...next[i], media_url: "" };
                              setOptions(next);
                            }}
                            title="Remove photo"
                            className="px-2 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

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
                  title: title || "Which option will be selected the most?",
                  category,
                  type: qType,
                  notes: questionBannerUrl || null,
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

      {/* Selected Question Panel: 5x2 Picture Studio + Real-Time Guesses & Ascribed Points Chart */}
      {selectedQuestion && (
        <div className="wimbf-glass rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedQuestion.session_position && (
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-black">
                    Session Q{selectedQuestion.session_position} of 10
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase">
                  {selectedQuestion.category}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    selectedQuestion.type === "image"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-white/10 text-slate-300"
                  }`}
                >
                  {selectedQuestion.type === "image" ? "🖼 Picture Question (1:1 Square)" : `Format: ${selectedQuestion.type}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold">
                  Used in {selectedQuestion.sessions_used_count ?? 0} session(s)
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-2">
                {selectedQuestion.title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setPreviewQuestion({
                    title: selectedQuestion.title,
                    category: selectedQuestion.category,
                    type: selectedQuestion.type,
                    notes: selectedQuestion.notes,
                    options: selectedQuestion.question_options ?? [],
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 text-xs font-bold"
              >
                👁 Preview 5×2 Grid
              </button>
              <button
                type="button"
                onClick={() => openEditModal(selectedQuestion, true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
              >
                📷 Upload / Edit Pictures
              </button>
              <button
                type="button"
                onClick={() => openEditModal(selectedQuestion)}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold"
              >
                ✎ Edit Question
              </button>
              <button
                type="button"
                onClick={() => handleDeleteQuestion(selectedQuestion)}
                className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold"
              >
                🗑 Delete Question
              </button>
              <div className="text-right pl-2">
                <p className="text-xs uppercase tracking-wider text-slate-400">Total Guesses</p>
                <p className="text-2xl font-black text-amber-400">
                  {(selectedQuestion.total_guesses ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* 5x2 Visual Option Cards with Direct 1-Click Photo Upload on Every Option */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                5×2 Square Option Grid (800 x 800 px) · Click &ldquo;📷 Upload Photo&rdquo; on any option to upload directly
              </p>
              <button
                type="button"
                onClick={() => openEditModal(selectedQuestion, true)}
                className="text-xs font-bold text-emerald-400 hover:underline"
              >
                Bulk Upload All 10 Photos →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(selectedQuestion.question_options ?? []).map((opt, idx) => {
                const slotKey = `inline-${opt.id}`;
                const isUploading = Boolean(uploadingSlot[slotKey]);
                const hasImg = isImageUrl(opt.media_url);
                return (
                  <div
                    key={opt.id}
                    className="rounded-2xl overflow-hidden bg-[#0b0e14] border border-white/10 flex flex-col justify-between"
                  >
                    <div className="relative aspect-square w-full bg-slate-900 overflow-hidden">
                      {hasImg ? (
                        <img
                          src={opt.media_url!}
                          alt={opt.label}
                          width={400}
                          height={400}
                          loading="lazy"
                          className="w-full h-full object-cover object-center"
                        />
                      ) : selectedQuestion.type === "color" && opt.media_url ? (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: opt.media_url }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs p-2 text-center">
                          <span>Option #{idx + 1}</span>
                          <span className="text-[10px] text-slate-600">800 x 800 px</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-bold text-amber-300">
                        {opt.points ?? 1} pts
                      </span>
                    </div>

                    <div className="p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-white truncate" title={opt.label}>
                          {opt.label}
                        </p>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {opt.percentage ?? 0}%
                        </span>
                      </div>

                      <div>
                        <input
                          id={`inline-upload-${opt.id}`}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) =>
                            handleInlineOptionUpload(
                              selectedQuestion.id,
                              opt.id,
                              opt.label,
                              e.target.files?.[0] ?? null
                            )
                          }
                        />
                        <label
                          htmlFor={`inline-upload-${opt.id}`}
                          className="w-full cursor-pointer inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-[11px] font-bold text-slate-300 hover:text-emerald-300 transition-colors"
                        >
                          {isUploading
                            ? "Uploading..."
                            : hasImg
                            ? "↻ Change Photo"
                            : "📷 Upload Photo"}
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Horizontal Bar Chart of 10 Options with Live Points (10 pts down to 1 pt) */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            {(() => {
              const opts = selectedQuestion.question_options ?? [];
              const maxGuesses = Math.max(...opts.map((o) => o.guesses ?? 0), 1);

              return opts.map((opt) => {
                const guesses = opt.guesses ?? 0;
                const pct = opt.percentage ?? 0;
                const avgSec = opt.avg_response_ms
                  ? `${(opt.avg_response_ms / 1000).toFixed(1)}s`
                  : "-";
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
                      {isImageUrl(opt.media_url) && (
                        <img
                          src={opt.media_url!}
                          alt={opt.label}
                          width={32}
                          height={32}
                          loading="lazy"
                          className="size-8 aspect-square rounded-md object-cover object-center shrink-0 border border-white/20"
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

      {/* Filter & Search Bar (Includes Format Filter for Picture Questions) */}
      <div className="wimbf-glass rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="w-full lg:w-auto flex flex-wrap items-center gap-2">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${
                filter === s
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/[0.02] text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}

          <span className="h-4 w-px bg-white/10 mx-1" />

          {(
            [
              { id: "all", label: "All Formats" },
              { id: "image", label: `🖼 Picture (${pictureQuestionCount})` },
              { id: "text", label: "Aa Text" },
              { id: "color", label: "🎨 Colour" },
              { id: "number", label: "🔢 Number" },
            ] as const
          ).map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTypeFilter(tf.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                typeFilter === tf.id
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-white/[0.02] text-slate-400 hover:text-slate-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="w-full lg:w-72">
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
                  <th className="px-5 py-4">Question &amp; Option Thumbnails</th>
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
                  const imgOpts = (q.question_options ?? []).filter((o) =>
                    isImageUrl(o.media_url)
                  );
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
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[11px] font-black shrink-0">
                              Q{q.session_position}
                            </span>
                          )}
                          <span className="truncate">{q.title}</span>
                        </div>
                        {imgOpts.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-2">
                            {imgOpts.slice(0, 6).map((o) => (
                              <img
                                key={o.id}
                                src={o.media_url!}
                                alt={o.label}
                                width={36}
                                height={36}
                                loading="lazy"
                                className="size-9 aspect-square rounded-lg object-cover object-center border border-white/15"
                                title={o.label}
                              />
                            ))}
                            {imgOpts.length > 6 && (
                              <span className="text-[10px] font-mono text-emerald-300 pl-1">
                                +{imgOpts.length - 6} photos
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {q.question_options?.length ?? 0} options configured
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-300">{q.category}</td>
                      <td className="px-4 py-4 text-xs uppercase font-bold">
                        <span
                          className={`px-2 py-1 rounded-lg ${
                            q.type === "image"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "text-amber-400"
                          }`}
                        >
                          {q.type === "image" ? "🖼 PICTURE" : q.type}
                        </span>
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
                                className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300"
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
                          aria-label={`Status for ${q.title}`}
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
                            type="button"
                            onClick={() =>
                              setPreviewQuestion({
                                title: q.title,
                                category: q.category,
                                type: q.type,
                                notes: q.notes,
                                options: q.question_options ?? [],
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-bold"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(q, true)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold"
                          >
                            📷 Photos
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(q)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
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

      {/* Edit Question Modal with Direct Image Upload */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-[#0f1219] border border-white/15 p-6 md:p-8 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  Edit Question &amp; Upload Option Pictures
                </h2>
                <p className="text-xs text-slate-400">
                  Upload photos directly from your device for each of the 10 options, or update the question prompt and format.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-question-prompt"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1"
                >
                  Question Prompt
                </label>
                <input
                  id="edit-question-prompt"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="edit-question-category"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="edit-question-category"
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
                  <label
                    htmlFor="edit-question-format"
                    className="block text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-1"
                  >
                    Format
                  </label>
                  <select
                    id="edit-question-format"
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value as "text" | "number" | "color" | "image")
                    }
                    className="w-full rounded-xl border border-emerald-500/40 bg-[#0e121b] px-3 py-2.5 text-xs font-bold text-white"
                  >
                    <option value="image">🖼 Picture (10 Image Options)</option>
                    <option value="text">Aa Text</option>
                    <option value="number">🔢 Number</option>
                    <option value="color">🎨 Colour</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-question-status"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-question-status"
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

              {/* Optional Question Prompt Picture Upload */}
              <div className="rounded-2xl p-3.5 bg-[#0b0e14] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {editBannerUrl ? (
                    <img
                      src={editBannerUrl}
                      alt="Question prompt"
                      width={80}
                      height={56}
                      className="w-16 h-12 rounded-lg object-cover border border-emerald-500/40"
                    />
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-white/[0.03] border border-dashed border-white/15 flex items-center justify-center text-[10px] text-slate-500">
                      No Banner
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-white">
                      Question Header Photo (Optional)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Upload a main question image if the prompt itself displays a photo.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="edit-banner-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleBannerUpload("edit", e.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor="edit-banner-upload"
                    className="cursor-pointer px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
                  >
                    {uploadingSlot["banner-edit"]
                      ? "Uploading..."
                      : editBannerUrl
                      ? "↻ Change Photo"
                      : "📷 Upload Question Photo"}
                  </label>
                  {editBannerUrl && (
                    <button
                      type="button"
                      onClick={() => setEditBannerUrl("")}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <fieldset className="space-y-3 border border-white/10 rounded-2xl p-4 bg-[#0b0e14]">
                <legend className="px-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  10 Options (1:1 Square · 800 x 800 px Template)
                </legend>

                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <span className="text-xs text-slate-300">
                    Recommended: <strong className="text-emerald-300 font-mono">800 x 800 px (1:1 Square)</strong>. Non-square uploads auto-crop to 800 x 800.
                  </span>
                  <div>
                    <input
                      id="edit-bulk-option-images"
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => handleEditBulkFilesUpload(e.target.files)}
                    />
                    <label
                      htmlFor="edit-bulk-option-images"
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs"
                    >
                      {uploadingSlot["edit-bulk"]
                        ? "Normalizing..."
                        : "📁 Bulk Upload 10 Square Pictures"}
                    </label>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {editOptions.map((opt, idx) => {
                    const isUploading = Boolean(uploadingSlot[`edit-${idx}`]);
                    const hasImg = isImageUrl(opt.media_url);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/10"
                      >
                        <span className="size-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                          {idx + 1}
                        </span>

                        {editType === "color" ? (
                          <input
                            type="color"
                            aria-label={`Option ${idx + 1} colour`}
                            value={opt.media_url.startsWith("#") ? opt.media_url : "#F59E0B"}
                            onChange={(e) => {
                              const next = [...editOptions];
                              next[idx] = { ...next[idx], media_url: e.target.value };
                              setEditOptions(next);
                            }}
                            className="size-9 rounded-lg border border-white/20 bg-transparent cursor-pointer shrink-0"
                          />
                        ) : hasImg ? (
                          <img
                            src={opt.media_url}
                            alt={opt.label || `Option ${idx + 1}`}
                            width={88}
                            height={88}
                            className="size-11 aspect-square rounded-xl object-cover object-center border border-emerald-500/40 shrink-0 bg-slate-900"
                          />
                        ) : (
                          <div className="size-11 aspect-square rounded-xl bg-white/[0.03] border border-dashed border-white/15 flex items-center justify-center text-[9px] text-slate-500 shrink-0">
                            1:1
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <label htmlFor={`edit-opt-label-${idx}`} className="sr-only">
                            Option {idx + 1} Label
                          </label>
                          <input
                            id={`edit-opt-label-${idx}`}
                            value={opt.label}
                            onChange={(e) => {
                              const next = [...editOptions];
                              next[idx] = { ...next[idx], label: e.target.value };
                              setEditOptions(next);
                            }}
                            placeholder={`Option ${idx + 1} label`}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white"
                          />
                        </div>

                        {editType !== "color" && editType !== "number" && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              id={`edit-opt-file-${idx}`}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) =>
                                handleEditOptionFileUpload(idx, e.target.files?.[0] ?? null)
                              }
                            />
                            <label
                              htmlFor={`edit-opt-file-${idx}`}
                              className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold"
                            >
                              {isUploading ? "..." : hasImg ? "↻ Photo" : "📷 Upload"}
                            </label>
                            {hasImg && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...editOptions];
                                  next[idx] = { ...next[idx], media_url: "" };
                                  setEditOptions(next);
                                }}
                                className="px-2 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(editingQuestion)}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold"
                >
                  🗑 Delete Question
                </button>
                <div className="flex items-center gap-3">
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
                    {savingEdit ? "Saving..." : "Save Question & Pictures"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Question Confirmation Modal */}
      {questionToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-question-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#111520] border border-rose-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold uppercase">
                  Confirm Deletion
                </span>
                <h2 id="delete-question-title" className="text-lg font-extrabold text-white mt-1.5">
                  Delete Question from Bank?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl p-3.5 bg-white/[0.03] border border-white/10 space-y-1">
              <p className="text-xs font-bold text-white leading-snug">
                &ldquo;{questionToDelete.title}&rdquo;
              </p>
              <p className="text-[11px] text-slate-400">
                Category: {questionToDelete.category} · Format: {questionToDelete.type.toUpperCase()} ·{" "}
                {questionToDelete.question_options?.length ?? 10} options
              </p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently remove the question, its 10 options, and any session assignments from the Question Bank.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteQuestion}
                className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold shadow-lg shadow-rose-500/20"
              >
                {deleting ? "Deleting..." : "Yes, Delete Question"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5x2 Player Grid Preview Modal (Renders Picture Options in 1:1 Square 5x2 Grid per Pages 11 to 13 & 26) */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#0f1422] border border-amber-500/40 p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase">
                  Player Gameplay Preview · {previewQuestion.category}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-semibold uppercase">
                  5×2 Grid · 1:1 Square ({previewQuestion.type})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                ✕ Close Preview
              </button>
            </div>

            <div className="text-center space-y-3 py-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Guess What Other Players Will Select
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {previewQuestion.title}
              </h3>
              {isImageUrl(previewQuestion.notes) && (
                <div className="flex justify-center pt-2">
                  <img
                    src={previewQuestion.notes!}
                    alt={previewQuestion.title}
                    width={360}
                    height={220}
                    className="max-h-48 rounded-2xl object-cover border border-white/20 shadow-lg"
                  />
                </div>
              )}
            </div>

            {/* 5x2 Grid Representation matching Pages 6 to 13 of Product Document */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
              {previewQuestion.options.slice(0, 10).map((opt, idx) => {
                const hasImg = isImageUrl(opt.media_url);
                return (
                  <div
                    key={idx}
                    className="rounded-2xl overflow-hidden bg-[#151c2e] hover:bg-amber-500/20 border border-white/15 hover:border-amber-400 transition-all flex flex-col items-center justify-between cursor-pointer"
                  >
                    {(previewQuestion.type === "image" || hasImg) ? (
                      <>
                        <div className="aspect-square w-full bg-[#0e1320] overflow-hidden">
                          {hasImg ? (
                            <img
                              src={opt.media_url!}
                              alt={opt.label || `Option ${idx + 1}`}
                              width={400}
                              height={400}
                              className="w-full h-full object-cover object-center"
                            />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-xs text-slate-500">
                              800 x 800
                            </div>
                          )}
                        </div>
                        <div className="border-t border-white/[0.06] px-2.5 py-2 text-center w-full">
                          <span className="text-xs font-bold text-white line-clamp-1">
                            {opt.label || `Option ${idx + 1}`}
                          </span>
                        </div>
                      </>
                    ) : previewQuestion.type === "color" ? (
                      <div className="p-4 flex flex-col items-center gap-2">
                        <span
                          className="size-12 rounded-full border-2 border-white/50 shadow-md"
                          style={{ backgroundColor: opt.media_url || "#F59E0B" }}
                        />
                        <span className="text-xs font-bold text-white">
                          {opt.label || `Option ${idx + 1}`}
                        </span>
                      </div>
                    ) : previewQuestion.type === "number" ? (
                      <div className="p-4 flex items-center justify-center min-h-[84px]">
                        <span className="text-3xl font-black text-amber-400">
                          {opt.label || idx}
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 flex items-center justify-center min-h-[84px] text-center">
                        <span className="text-xs sm:text-sm font-bold text-white leading-tight">
                          {opt.label || `Option ${idx + 1}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
              <span>10 Options · Points awarded dynamically from 10 pts (#1) down to 1 pt (#10)</span>
              <button
                type="button"
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
