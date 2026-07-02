'use client';

import { useState } from 'react';

interface PhotoReaction {
  reaction: string;
  userId: string;
}

interface PhotoReactionButtonProps {
  photoId: string;
  reactions: PhotoReaction[];
  userId?: string;
}

const AVAILABLE_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'];

export default function PhotoReactionButton({
  photoId,
  reactions,
  userId,
}: PhotoReactionButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);

  const reactionCounts = localReactions.reduce(
    (acc, r) => {
      acc[r.reaction] = (acc[r.reaction] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const userReactions = userId
    ? localReactions.filter((r) => r.userId === userId).map((r) => r.reaction)
    : [];

  const handleReaction = async (reaction: string) => {
    if (!userId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/photo-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, reaction }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocalReactions((prev) => {
          if (data.action === 'removed') {
            return prev.filter((r) => !(r.reaction === reaction && r.userId === userId));
          } else {
            return [...prev, { reaction, userId }];
          }
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute right-2 bottom-2">
      <div className="flex items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur-sm">
        {AVAILABLE_REACTIONS.map((emoji) => {
          const count = reactionCounts[emoji] || 0;
          const isSelected = userReactions.includes(emoji);

          return (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              disabled={!userId || isSubmitting}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-all ${
                isSelected ? 'scale-110 bg-white/30' : 'hover:bg-white/20'
              } ${!userId ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
              title={userId ? `${emoji} (${count})` : 'Sign in to react'}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-white">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
