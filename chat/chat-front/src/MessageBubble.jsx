import React from "react";

export default function MessageBubble({ m, isMine }) {
  const containerClass = isMine ? "flex justify-end my-3" : "flex justify-start my-3";
  const bubbleClass = isMine
    ? "px-4 py-3 rounded-2xl shadow-sm bg-purple-600 bg-opacity-20 text-white max-w-3xl"
    : "px-4 py-3 rounded-2xl bg-gray-800 text-gray-100 max-w-3xl";

  return (
    <div className={containerClass}>
      {!isMine && (
        <div className="mr-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-semibold text-white">
            {m.sender_username ? m.sender_username.slice(0,2).toUpperCase() : "?"}
          </div>
        </div>
      )}

      <div className={isMine ? "text-right" : "text-left"}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-sm">{isMine ? "Vous" : (m.sender_username || "inconnu")}</span>
          <span className="text-xs text-gray-400">
            {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
          </span>
        </div>

        <div className={bubbleClass}>
          <div className="text-sm whitespace-pre-wrap">{m.content}</div>
          {m.edited && <div className="text-xs text-gray-400 mt-1">• édité</div>}
          {m._pending && <div className="text-xs text-gray-400 mt-1">• Envoi...</div>}
        </div>
      </div>

      {isMine && (
        <div className="ml-3">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-sm font-semibold text-white">YO</div>
        </div>
      )}
    </div>
  );
}
