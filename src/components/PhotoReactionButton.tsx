'use client';

import { useState } from 'react';
import { usePhotoReactionMutation } from '~/hooks';

interface PhotoReaction {
  reaction: string;
  userId: string;
}

interface PhotoReactionButtonProps {
  photoId: string;
  reactions: PhotoReaction[];
  userId?: string;
  compact?: boolean;
}

const AVAILABLE_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'];

export default function PhotoReactionButton({
  photoId,
  reactions,
  userId,
  compact = false,
}: PhotoReactionButtonProps) {
  const { addReaction, removeReaction } = usePhotoReactionMutation();
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
      const hasReacted = userReactions.includes(reaction);

      if (hasReacted) {
        await removeReaction.mutateAsync({ photoId, reaction });
        setLocalReactions((prev) =>
          prev.filter((r) => !(r.reaction === reaction && r.userId === userId)),
        );
      } else {
        await addReaction.mutateAsync({ photoId, reaction });
        setLocalReactions((prev) => [...prev, { reaction, userId }]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur-sm">
        {AVAILABLE_REACTIONS.slice(0, 3).map((emoji) => {
          const count = reactionCounts[emoji] || 0;
          const isSelected = userReactions.includes(emoji);

          return (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              disabled={!userId || isSubmitting}
              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-all ${
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
    );
  }

  return (
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
  );
}
