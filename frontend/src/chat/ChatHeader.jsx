import React from "react";

export default function ChatHeader({ channelName = "general", description = "Project discussion and updates" }) {
    return (
      <header className="flex justify-between items-center p-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-bold"># {channelName}</h2>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
       {/* Icone */}
        <div className="flex items-center space-x-2">
          <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700">
            {/* Icone */}
            📌
          </button>
          <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700">
            ⚙️
          </button>
        </div>
      </header>
    );
  }