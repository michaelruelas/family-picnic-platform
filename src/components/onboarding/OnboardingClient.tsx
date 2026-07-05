'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardStep from './WizardStep';

interface HouseholdOption {
  id: string;
  name: string;
  memberCount: number;
}

interface OnboardingClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    hasHousehold: boolean;
  };
  households: HouseholdOption[];
}

type Step = 'household' | 'family' | 'preferences';

const STEPS: { key: Step; label: string }[] = [
  { key: 'household', label: 'Household' },
  { key: 'family', label: 'Family Members' },
  { key: 'preferences', label: 'Preferences' },
];

export default function OnboardingClient({ user: _user, households }: OnboardingClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('household');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [householdMode, setHouseholdMode] = useState<'create' | 'join' | null>(null);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

  const [familyMembers, setFamilyMembers] = useState<
    Array<{
      name: string;
      relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'INLAW' | 'COUSIN';
      age: string;
      isChild: boolean;
    }>
  >([]);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [newFamilyMember, setNewFamilyMember] = useState({
    name: '',
    relationship: 'SPOUSE' as const,
    age: '',
    isChild: false,
  });

  const [communicationPreference, setCommunicationPreference] = useState<
    'EMAIL' | 'SMS' | 'BOTH' | 'NONE'
  >('EMAIL');

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHouseholdName.trim() }),
      });

      if (!res.ok) {
        throw new Error('Failed to create household');
      }

      setCurrentStep('family');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinHousehold = async () => {
    if (!selectedHouseholdId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinHouseholdId: selectedHouseholdId }),
      });

      if (!res.ok) {
        throw new Error('Failed to join household');
      }

      setCurrentStep('family');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFamilyMember = () => {
    if (!newFamilyMember.name.trim()) return;
    setFamilyMembers([
      ...familyMembers,
      {
        name: newFamilyMember.name.trim(),
        relationship: newFamilyMember.relationship,
        age: newFamilyMember.age,
        isChild: newFamilyMember.isChild,
      },
    ]);
    setNewFamilyMember({ name: '', relationship: 'SPOUSE', age: '', isChild: false });
    setShowFamilyForm(false);
  };

  const handleRemoveFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const handleSkipFamily = async () => {
    setCurrentStep('preferences');
  };

  const handleNextFamily = async () => {
    setIsLoading(true);
    setError(null);

    try {
      for (const member of familyMembers) {
        await fetch('/api/onboarding/dependent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(member),
        });
      }
      setCurrentStep('preferences');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add family members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communicationPreference }),
      });

      router.push('/profile');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const renderHouseholdStep = () => (
    <WizardStep
      title="Set Up Your Household"
      description="Your household groups your family together for RSVPs and planning."
      isFirst={currentStepIndex === 0}
      nextLabel="Continue"
      onNext={() => setHouseholdMode('create')}
      nextDisabled={!householdMode}
    >
      {error && (
        <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {!householdMode ? (
        <div className="space-y-4">
          <p className="text-foreground/85 text-lg">How would you like to set up your household?</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setHouseholdMode('create')}
              className="border-border hover:border-terracotta hover:bg-sunlight/20 flex items-center gap-4 rounded-lg border-2 p-6 text-left"
            >
              <span className="text-3xl">🏠</span>
              <div>
                <p className="text-foreground text-lg font-semibold">Create a new household</p>
                <p className="text-muted-foreground text-sm">
                  Start fresh and invite family members later
                </p>
              </div>
            </button>

            {households.length > 0 && (
              <button
                onClick={() => setHouseholdMode('join')}
                className="border-border hover:border-terracotta hover:bg-sunlight/20 flex items-center gap-4 rounded-lg border-2 p-6 text-left"
              >
                <span className="text-3xl">👨‍👩‍👧‍👦</span>
                <div>
                  <p className="text-foreground text-lg font-semibold">
                    Join an existing household
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Connect with family already on the platform
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      ) : householdMode === 'create' ? (
        <div className="space-y-6">
          <button
            onClick={() => setHouseholdMode(null)}
            className="text-muted-foreground hover:text-foreground/85 text-sm"
          >
            ← Change option
          </button>
          <div>
            <label className="text-foreground/85 block text-lg font-medium">Household Name</label>
            <p className="text-muted-foreground mb-2 text-sm">
              This is how your family will appear to other members
            </p>
            <input
              type="text"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              placeholder="The Johnson Family"
              className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-4 py-3 text-lg shadow-sm focus:ring-1 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCreateHousehold}
            disabled={!newHouseholdName.trim() || isLoading}
            className="bg-terracotta hover:bg-terracotta w-full rounded-lg px-6 py-3 text-lg font-medium text-white disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Household'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <button
            onClick={() => setHouseholdMode(null)}
            className="text-muted-foreground hover:text-foreground/85 text-sm"
          >
            ← Change option
          </button>
          <div>
            <label className="text-foreground/85 block text-lg font-medium">
              Select a Household
            </label>
            <p className="text-muted-foreground mb-2 text-sm">Choose the household you belong to</p>
            <select
              value={selectedHouseholdId || ''}
              onChange={(e) => setSelectedHouseholdId(e.target.value || null)}
              className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-4 py-3 text-lg shadow-sm focus:ring-1 focus:outline-none"
            >
              <option value="">Select a household...</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.memberCount} members)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleJoinHousehold}
            disabled={!selectedHouseholdId || isLoading}
            className="bg-terracotta hover:bg-terracotta w-full rounded-lg px-6 py-3 text-lg font-medium text-white disabled:opacity-50"
          >
            {isLoading ? 'Joining...' : 'Join Household'}
          </button>
        </div>
      )}
    </WizardStep>
  );

  const renderFamilyStep = () => (
    <WizardStep
      title="Add Family Members"
      description="Add your spouse, children, or other family members to help us plan for everyone."
      onBack={() => setCurrentStep('household')}
      onSkip={handleSkipFamily}
      skipLabel="Skip for now"
      nextLabel={familyMembers.length > 0 ? 'Add Members & Continue' : 'Continue'}
      onNext={handleNextFamily}
      nextDisabled={isLoading}
      isLoading={isLoading}
    >
      {error && (
        <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {familyMembers.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {familyMembers.map((member, index) => (
            <li
              key={index}
              className="bg-secondary/60 flex items-center justify-between rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{member.isChild ? '👶' : '👤'}</span>
                <div>
                  <p className="text-foreground font-medium">{member.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {member.relationship}
                    {member.age ? ` • ${member.age} years old` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFamilyMember(index)}
                className="text-destructive hover:text-foreground text-sm"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mb-4 text-lg">No family members added yet.</p>
      )}

      {showFamilyForm ? (
        <div className="border-border bg-secondary/60 rounded-lg border p-4">
          <h3 className="text-foreground mb-4 text-lg font-medium">Add Family Member</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-foreground/85 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={newFamilyMember.name}
                onChange={(e) => setNewFamilyMember({ ...newFamilyMember, name: e.target.value })}
                placeholder="Full name"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-foreground/85 block text-sm font-medium">Relationship</label>
              <select
                value={newFamilyMember.relationship}
                onChange={(e) =>
                  setNewFamilyMember({
                    ...newFamilyMember,
                    relationship: e.target.value as typeof newFamilyMember.relationship,
                  })
                }
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              >
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="SIBLING">Sibling</option>
                <option value="INLAW">In-Law</option>
                <option value="COUSIN">Cousin</option>
              </select>
            </div>
            <div>
              <label className="text-foreground/85 block text-sm font-medium">Age (optional)</label>
              <input
                type="number"
                value={newFamilyMember.age}
                onChange={(e) => setNewFamilyMember({ ...newFamilyMember, age: e.target.value })}
                placeholder="Age in years"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newFamilyMember.isChild}
                  onChange={(e) =>
                    setNewFamilyMember({ ...newFamilyMember, isChild: e.target.checked })
                  }
                  className="border-border text-terracotta focus:ring-foreground/20 h-5 w-5 rounded"
                />
                <span className="text-foreground/85 text-sm">Under 18 (child)</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddFamilyMember}
              disabled={!newFamilyMember.name.trim()}
              className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              Add Member
            </button>
            <button
              onClick={() => {
                setShowFamilyForm(false);
                setNewFamilyMember({ name: '', relationship: 'SPOUSE', age: '', isChild: false });
              }}
              className="border-border text-foreground/85 hover:bg-secondary/60 flex-1 rounded-lg border px-4 py-2 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowFamilyForm(true)}
          className="border-border text-muted-foreground hover:border-terracotta hover:text-terracotta flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-lg font-medium"
        >
          + Add Family Member
        </button>
      )}
    </WizardStep>
  );

  const renderPreferencesStep = () => (
    <WizardStep
      title="Stay Connected"
      description="How would you like to receive updates about events and announcements?"
      onBack={() => setCurrentStep('family')}
      nextLabel="Complete Setup"
      onNext={handleComplete}
      nextDisabled={isLoading}
      isLast={true}
      isLoading={isLoading}
    >
      {error && (
        <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <p className="text-foreground/85 text-lg">Choose your notification preference:</p>

        <div className="space-y-3">
          {[
            {
              value: 'EMAIL',
              label: 'Email',
              description: 'Receive updates at your email address',
              icon: '📧',
            },
            {
              value: 'SMS',
              label: 'Text Message',
              description: 'Get quick texts for important updates',
              icon: '📱',
            },
            {
              value: 'BOTH',
              label: 'Both Email & Text',
              description: 'Stay informed through multiple channels',
              icon: '📬',
            },
            {
              value: 'NONE',
              label: 'No Notifications',
              description: 'Check for updates manually',
              icon: '🔕',
            },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() =>
                setCommunicationPreference(option.value as typeof communicationPreference)
              }
              className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-colors ${
                communicationPreference === option.value
                  ? 'border-terracotta bg-sunlight/20'
                  : 'border-border hover:border-border'
              }`}
            >
              <span className="text-3xl">{option.icon}</span>
              <div>
                <p className="text-foreground text-lg font-semibold">{option.label}</p>
                <p className="text-muted-foreground text-sm">{option.description}</p>
              </div>
              {communicationPreference === option.value && (
                <span className="text-terracotta ml-auto text-2xl">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </WizardStep>
  );

  return (
    <div className="bg-secondary/60 rounded-xl p-6 shadow-sm ring-1 ring-stone-200">
      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                index <= currentStepIndex
                  ? 'bg-terracotta text-white'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {index < currentStepIndex ? '✓' : index + 1}
            </div>
            <span
              className={`ml-2 text-sm ${index === currentStepIndex ? 'text-terracotta font-medium' : 'text-muted-foreground'}`}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-4 h-0.5 w-12 ${index < currentStepIndex ? 'bg-terracotta' : 'bg-secondary'}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        {currentStep === 'household' && renderHouseholdStep()}
        {currentStep === 'family' && renderFamilyStep()}
        {currentStep === 'preferences' && renderPreferencesStep()}
      </div>
    </div>
  );
}
