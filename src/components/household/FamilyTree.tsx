'use client';

import { useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Dependent {
  id: string;
  name: string;
  relationship: string;
  age: number | null;
  isChild: boolean;
}

interface HouseholdNode {
  id: string;
  name: string;
  users: User[];
  dependents: Dependent[];
  children: HouseholdNode[];
}

interface FamilyTreeProps {
  households: HouseholdNode[];
}

function HouseholdNodeComponent({ node, level = 0 }: { node: HouseholdNode; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [showDetails, setShowDetails] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const totalMembers = node.users.length + node.dependents.length;

  return (
    <li className="relative">
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg p-3 transition-colors ${
          level === 0 ? 'border-sunlight/40 bg-sunlight/20 border' : 'border-border border bg-white'
        } hover:shadow-sm`}
        style={{ marginLeft: level > 0 ? '1.5rem' : 0 }}
      >
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-secondary text-muted-foreground hover:bg-secondary flex h-6 w-6 items-center justify-center rounded text-xs font-bold"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
        {!hasChildren && <span className="w-6" />}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-semibold">{node.name}</span>
            <span className="text-muted-foreground text-xs">
              ({totalMembers} {totalMembers === 1 ? 'member' : 'members'})
            </span>
          </div>

          <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
            {node.users.length > 0 && (
              <span>
                {node.users.length} adult{node.users.length !== 1 ? 's' : ''}
              </span>
            )}
            {node.dependents.length > 0 && (
              <span>
                {node.dependents.filter((d) => d.isChild).length} children,{' '}
                {node.dependents.filter((d) => !d.isChild).length} other
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-terracotta hover:bg-sunlight/20 rounded px-2 py-1 text-xs font-medium"
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>

      {showDetails && (
        <div
          className="border-border rounded-lg border bg-white p-4"
          style={{ marginLeft: level > 0 ? '1.5rem' : 0, marginTop: '0.5rem' }}
        >
          {node.users.length > 0 && (
            <div className="mb-3">
              <h4 className="text-foreground/85 text-sm font-medium">Adults</h4>
              <ul className="mt-1 space-y-1">
                {node.users.map((user) => (
                  <li
                    key={user.id}
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {user.name}
                    <span className="text-muted-foreground/70 text-xs">({user.email})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {node.dependents.length > 0 && (
            <div>
              <h4 className="text-foreground/85 text-sm font-medium">Dependents</h4>
              <ul className="mt-1 space-y-1">
                {node.dependents.map((dep) => (
                  <li
                    key={dep.id}
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${dep.isChild ? 'bg-blue-400' : 'bg-green-400'}`}
                    />
                    {dep.name}
                    <span className="text-muted-foreground/70 text-xs">
                      ({dep.relationship}
                      {dep.age !== null ? `, ${dep.age} years old` : ''})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {node.users.length === 0 && node.dependents.length === 0 && (
            <p className="text-muted-foreground/70 text-sm">No members yet</p>
          )}
        </div>
      )}

      {isExpanded && hasChildren && (
        <ul className="border-border mt-2 space-y-2 border-l-2 pl-4">
          {node.children.map((child) => (
            <HouseholdNodeComponent key={child.id} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FamilyTree({ households }: FamilyTreeProps) {
  if (households.length === 0) {
    return (
      <div className="bg-secondary rounded-xl p-8 text-center">
        <div className="text-4xl">🌳</div>
        <h3 className="text-foreground/85 mt-4 text-lg font-medium">No Households Yet</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Households will appear here once families start signing up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {households.map((household) => (
          <HouseholdNodeComponent key={household.id} node={household} level={0} />
        ))}
      </ul>
    </div>
  );
}
