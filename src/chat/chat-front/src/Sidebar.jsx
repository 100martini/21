import React from "react";

export default function Sidebar({ conversations = [], onOpenConversation = () => {}, token = "", saveToken = () => {}, createTestConversation = () => {} }) {
  return (
    <aside className="w-80 bg-gray-900 text-gray-100 border-r border-gray-800 p-5 flex flex-col">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">FT</div>
        <div>
          <h2 className="text-xl font-extrabold">FT_transcendence</h2>
          <div className="text-xs text-gray-400">Project chat</div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-gray-400">JWT Token (dev)</label>
        <textarea
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          className="w-full mt-2 p-2 bg-gray-800 text-gray-100 rounded resize-none"
          rows={3}
        />
        <div className="flex gap-2 mt-2">
          <button onClick={createTestConversation} className="px-3 py-1 rounded bg-green-600 text-sm">Créer conv test</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Canaux</h3>
        <nav className="mb-4 space-y-1">
          <a className="block px-3 py-2 rounded hover:bg-gray-800 text-purple-300 cursor-pointer"># general</a>
          <a className="block px-3 py-2 rounded hover:bg-gray-800 text-purple-300 cursor-pointer"># backend</a>
          <a className="block px-3 py-2 rounded hover:bg-gray-800 text-purple-300 cursor-pointer"># frontend</a>
          <a className="block px-3 py-2 rounded hover:bg-gray-800 text-purple-300 cursor-pointer"># random</a>
        </nav>

        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Direct messages</h3>
        <ul className="space-y-2">
          {conversations.map(c => (
            <li key={c.id}>
              <button
                onClick={() => onOpenConversation(c)}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-800 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-sm">{c.name || `Conversation ${c.id}`}</div>
                  <div className="text-xs text-gray-500">{c.is_group ? "Groupe" : "1:1"}</div>
                </div>
                <div className="text-xs text-gray-400"></div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
