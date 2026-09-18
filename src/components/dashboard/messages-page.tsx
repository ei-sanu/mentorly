'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, RefreshCw, AlertCircle, Inbox, Loader2, Search } from 'lucide-react';
import { messagingService, type Conversation, type ChatMessage } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export function MessagesPage({ allowedRoles }: { allowedRoles: string[] }) {
  const { allowed, user } = useRoleGuard(allowedRoles);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      setLoadingConvos(true);
      setError(null);
      const data = await messagingService.getConversations();
      setConversations(data || []);
      if (!activeId && data && data.length > 0) {
        setActiveId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations.');
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const data = await messagingService.getMessages(conversationId, 100);
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (allowed) loadConversations();
  }, [allowed]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const active = conversations.find((c) => c.id === activeId);
  const otherParticipant = active?.participants.find((p) => p.id !== user?.id);
  const filteredConvos = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const names = c.participants.map((p) => `${p.firstName} ${p.lastName}`).join(' ').toLowerCase();
    return names.includes(q);
  });

  const handleSend = async () => {
    if (!activeId || !draft.trim() || sending) return;
    try {
      setSending(true);
      const sent = await messagingService.sendMessage(activeId, draft.trim());
      setMessages((prev) => [...prev, sent]);
      setDraft('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Messages"
        description="Your private conversations with mentors and mentees."
        icon={MessageSquare}
        actions={
          <Button variant="outline" onClick={loadConversations} size="sm" className="rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] h-[calc(100vh-220px)] min-h-[500px]">
        {/* Conversation List */}
        <Card className="overflow-hidden flex flex-col">
          <div className="p-4 border-b border-lpu-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lpu-text-muted" />
              <Input
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingConvos ? (
              <PageLoader message="Loading conversations…" />
            ) : filteredConvos.length === 0 ? (
              <PageEmptyState
                message="No conversations yet"
                hint="Accepted mentorship requests will appear here."
                icon={Inbox}
              />
            ) : (
              filteredConvos.map((c) => {
                const other = c.participants.find((p) => p.id !== user?.id);
                const name = other ? `${other.firstName} ${other.lastName}` : 'Conversation';
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-4 border-b border-lpu-border hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-orange-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-lpu-orange font-bold text-sm shrink-0">
                        {name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{name}</p>
                        {c.lastMessage && (
                          <p className="text-xs text-lpu-text-secondary truncate">
                            {c.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Active Conversation */}
        <Card className="flex flex-col overflow-hidden">
          {active ? (
            <>
              <div className="p-4 border-b border-lpu-border flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-lpu-orange font-bold text-sm">
                  {(otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'C').charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'Conversation'}
                  </p>
                  <p className="text-xs text-lpu-text-muted">Private conversation</p>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50/30">
                {loadingMessages ? (
                  <PageLoader message="Loading messages…" />
                ) : messages.length === 0 ? (
                  <PageEmptyState
                    message="No messages yet"
                    hint="Start the conversation by sending a message below."
                    icon={MessageSquare}
                  />
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isMe
                              ? 'bg-lpu-orange text-white'
                              : 'bg-white border border-gray-100 text-lpu-text-primary'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-lpu-text-muted'}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 border-t border-lpu-border">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    className="bg-lpu-orange hover:bg-lpu-orange/95 text-white rounded-xl"
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <PageEmptyState
                message="Select a conversation"
                hint="Choose a conversation from the list to view messages."
                icon={MessageSquare}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
