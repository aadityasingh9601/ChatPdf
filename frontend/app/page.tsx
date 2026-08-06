"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadData } from "./lib/actions/uploadData";
import { fetchData } from "./lib/actions/fetchData";
import { fetchChatData } from "./lib/actions/fetchChatData";
import { newChatMessage } from "./lib/actions/newChatMessage";
import { deleteData } from "./lib/actions/deleteData";
import { sendQuery } from "./lib/actions/sendQuery";
import { createClient } from "./lib/supabase/client";
import { formatMessageTime } from "./lib/utils/formatTime";
import Spinner from "./components/Spinner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  created_at: number | string;
}

interface Pdf {
   id: string; file_name: string 
}

type PdfStatus = "idle" | "selected" | "uploading" | "ready";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SELECTED_PDF_KEY = "selected-pdf";

const normalizeMessages = (
  rows: { role: "user" | "assistant"; content: string; created_at?: string }[],
): Message[] =>
  (rows ?? [])?.map((row) => ({
    role: row.role,
    content: row.content,
    created_at: row.created_at ?? Date.now(),
  }));

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string>("");
  const [currPdf, setCurrPdf] = useState<Pdf>({ id: "", file_name: "" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadedPdfs, setUploadedPdfs] = useState<
    { id: string; file_name: string }[]
  >([]);
  const [pdfToDelete, setPdfToDelete] = useState<{
    id: string;
    file_name: string;
  } | null>(null);
  const [isPdfsLoading, setIsPdfsLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        setIsPdfsLoading(true);
        try {
          const res = await fetchData(data.user.id);
          setUploadedPdfs(res?.message.data);
        } catch {
          setUploadedPdfs([]);
        } finally {
          setIsPdfsLoading(false);
        }

        const stored = window.localStorage.getItem("selected-pdf");
        if (stored) {
          try {
            const pdf = JSON.parse(stored) as Pdf;
            setCurrPdf(pdf);
            setPdfName(pdf.file_name);
            setPdfStatus("ready");
            setIsChatLoading(true);
            const chatRes = await fetchChatData(pdf.id);
            setMessages(normalizeMessages(chatRes.message.data));
          } catch {
            window.localStorage.removeItem("selected-pdf");
          } finally {
            setIsChatLoading(false);
          }
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (currPdf.id) {
      window.localStorage.setItem(SELECTED_PDF_KEY, JSON.stringify(currPdf));
    }
  }, [currPdf]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleFile = (file: File) => {
    setFileError("");
    if (file.type !== "application/pdf") {
      setFileError("Only PDF files are supported");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File must be under 5MB");
      return;
    }
    setPdfFile(file);
    setPdfName(file.name);
    setPdfStatus("selected");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleConfirmUpload = async () => {
    setPdfStatus("uploading");
    const res = await uploadData(userId, pdfFile);
    setPdfStatus("ready");
  };

  const handleCancelUpload = () => {
    setPdfFile(null);
    setPdfName("");
    setFileError("");
    setPdfStatus("idle");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, created_at: Date.now() },
    ]);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", created_at: Date.now() },
    ]);
    setIsLoading(true);
    //Save message to DB here.
    await newChatMessage(userId, currPdf.id, "user", question);

    try {
      const res = await sendQuery(userId, pdfName, question);
      const answer = res?.message?.answer || "No answer received.";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated?.length - 1] = {
          role: "assistant",
          content: answer,
          created_at: Date.now(),
        };
        return updated;
      });
      setIsLoading(false);
      //Save msg to DB.
      await newChatMessage(userId, currPdf.id, "assistant", answer);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated?.length - 1] = {
          role: "assistant",
          content: "Something went wrong! Please try again.",
          created_at: Date.now(),
        };
        return updated;
      });
      //Save msg to DB.
      await newChatMessage(
        userId,
        currPdf.id,
        "assistant",
        "Something went wrong! Please try again.",
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/auth");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfName("");
    setMessages([]);
    setFileError("");
    setPdfStatus("idle");
    setCurrPdf({ id: "", file_name: "" });
    window.localStorage.removeItem(SELECTED_PDF_KEY);
  };

  const handleSelectPdf = async (pdf: { id: string; file_name: string }) => {
    setCurrPdf(pdf);
    setPdfName(pdf.file_name);
    setPdfStatus("ready");
    setMessages([]);
    setSidebarOpen(false);
    setIsChatLoading(true);
    //Fetch chat messages from backend.
    try {
      const res = await fetchChatData(pdf.id);
      setMessages(normalizeMessages(res.message.data));
    } catch {
      setMessages([]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    await deleteData(
      pdfToDelete?.id,
      pdfToDelete?.file_name,
      userId,
    );
    setUploadedPdfs((prev) => prev.filter((p) => p.id !== pdfToDelete?.id));
    setPdfToDelete(null);
  };

  const handleResend = async (question: string) => {
    if (isLoading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, created_at: Date.now() },
    ]);
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", created_at: Date.now() },
    ]);

    try {
      const res = await sendQuery(userId, pdfName, question);
      const answer = res?.message?.answer || "No answer received.";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated?.length - 1] = {
          role: "assistant",
          content: answer,
          created_at: Date.now(),
        };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated?.length - 1] = {
          role: "assistant",
          content: "Something went wrong! Please try again.",
          created_at: Date.now(),
        };
        return updated;
      });
    }
    setIsLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full relative">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 animate-fade-in-fast"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white/95 backdrop-blur-sm shadow-2xl z-50 flex flex-col animate-slide-in ${
          sidebarOpen ? "" : "-translate-x-full"
        } transition-transform duration-200 ease-out`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100">
          <h3 className="text-md font-semibold text-zinc-900">
            Knowledge Sources
          </h3>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {isPdfsLoading ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center animate-fade-in">
              <Spinner className="w-5 h-5 text-indigo-400" />
              <p className="text-xs text-zinc-400">Loading your PDFs...</p>
            </div>
          ) : uploadedPdfs?.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-zinc-400">Add a PDF to get started</p>
            </div>
          ) : (
            <div className="space-y-0.5 px-2">
              {uploadedPdfs?.map((pdf) => (
                <div
                  key={pdf.id}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    pdfName === pdf.file_name && pdfStatus === "ready"
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-zinc-600 hover:bg-zinc-200"
                  }`}
                  onClick={() => handleSelectPdf(pdf)}
                >
                  <svg
                    className="w-4 h-4 shrink-0 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  <span className="flex-1 text-sm truncate">
                    {pdf.file_name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfToDelete(pdf);
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {pdfToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] animate-fade-in-fast">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPdfToDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-fade-in">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mx-auto mb-4">
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-zinc-900 text-center">
              Delete PDF
            </h4>
            <p className="text-xs text-zinc-500 text-center mt-1.5">
              Are you sure you want to delete{" "}
              <span className="font-medium text-zinc-700">
                {pdfToDelete.file_name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setPdfToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-indigo-500 hover:bg-indigo-50 transition-colors shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 shrink-0">
            <svg
              className="w-5 h-5 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-md font-medium text-zinc-900 truncate">
              {pdfStatus === "ready" ? pdfName : "ChatPDF"}
            </h2>
            <p className="text-sm text-zinc-400">
              {pdfStatus === "ready"
                ? "Ready to answer questions"
                : "Upload a PDF to get started"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pdfStatus === "ready" && (
            <button
              onClick={removePdf}
              className="text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors px-3.5 py-2 rounded-lg shadow-sm"
            >
              New PDF
            </button>
          )}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors px-3.5 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut && <Spinner className="w-3.5 h-3.5" />}
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>
      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ─── Upload Area ─── */}
        {pdfStatus === "idle" && (
          <div className="flex flex-1 items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-lg">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleUploadClick}
                className={`
                  group cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center
                  transition-all duration-200 bg-white/90 backdrop-blur-sm shadow-xl shadow-black/5
                  ${
                    isDragging
                      ? "upload-active border-indigo-400 bg-indigo-50/80"
                      : "border-zinc-200 hover:border-indigo-300 hover:bg-white"
                  }
                `}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors mb-4">
                  <svg
                    className="w-6 h-6 text-zinc-400 group-hover:text-indigo-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <p className="text-md font-medium text-zinc-700">
                  Drop your PDF here, or{" "}
                  <span className="text-indigo-500">browse</span>
                </p>
                <p className="text-sm text-zinc-500 mt-2">PDF only, max 5MB</p>
              </div>
              {fileError && (
                <p className="text-xs text-red-500 text-center mt-3 animate-fade-in">
                  {fileError}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </div>
        )}

        {/* ─── Confirm Selection (inline) ─── */}
        {pdfStatus === "selected" && (
          <div className="flex flex-1 items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-md">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/5 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 shrink-0">
                    <svg
                      className="w-6 h-6 text-indigo-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {pdfName}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">PDF document</p>
                  </div>
                  <button
                    onClick={handleCancelUpload}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={handleCancelUpload}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/25"
                  >
                    Add PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Uploading Loader (inline) ─── */}
        {pdfStatus === "uploading" && (
          <div className="flex flex-1 items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-md">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/5 p-8 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-4">
                  <svg
                    className="w-7 h-7 text-indigo-500 animate-spin-slow"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-900">
                  Uploading PDF
                </p>
                <p className="text-xs text-zinc-400 mt-1">{pdfName}</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Chat Messages ─── */}
        {pdfStatus === "ready" && (
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6">
            {isChatLoading ? (
              <div className="flex flex-1 items-center justify-center h-full min-h-[300px]">
                <div className="flex flex-col items-center gap-3 text-center animate-fade-in">
                  <Spinner className="w-7 h-7 text-indigo-400" />
                  <p className="text-sm text-white/70">Loading messages...</p>
                </div>
              </div>
            ) : messages?.length === 0 ? (
              <div className="flex flex-1 items-center justify-center h-full min-h-[300px]">
                <div className="text-center animate-fade-in">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm mb-3 shadow-sm">
                    <svg
                      className="w-6 h-6 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-white/70">
                    Ask anything about this document
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                {messages?.map((msg, i) => (
                  <div
                    key={i}
                    className={`animate-fade-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="group max-w-[85%] relative">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-500 text-white rounded-br-md shadow-md shadow-indigo-500/20"
                            : "bg-white/90 backdrop-blur-sm text-zinc-700 rounded-bl-md shadow-sm"
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.content && (
                          <div
                            className={`mt-1.5 flex justify-end text-[11px] ${
                              msg.role === "user"
                                ? "text-white/70"
                                : "text-zinc-400"
                            }`}
                          >
                            {formatMessageTime(msg.created_at)}
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && msg.content && (
                        <button
                          onClick={() => handleResend(msg.content)}
                          className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50"
                          title="Resend"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                            />
                          </svg>
                        </button>
                      )}
                      {msg.role === "assistant" && msg.content && (
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="absolute -right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50"
                          title="Copy"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      <div className="flex gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}

        {/* ─── Chat Input ─── */}
        {pdfStatus === "ready" && (
          <div className="border-t border-white/10 bg-white/80 backdrop-blur-sm p-4 shrink-0">
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
              <div className="flex items-end gap-2 bg-white rounded-2xl border border-zinc-200 focus-within:border-indigo-300 transition-colors px-4 py-2 shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your PDF..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 resize-none outline-none py-1.5 max-h-40"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-200 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-[13px] text-black/50 mt-2 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
