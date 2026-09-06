import { Conversation, DocumentCitation, ChatMessage } from '../types';

/**
 * Isolated visual mock data for KAVACH AI Chat Workbench.
 * 
 * NOTE: As per Phase 3 specifications, this mock data is isolated to the mock/
 * directory and is not mixed with production API logic. It serves visual and
 * development preview states and can be swapped or purged when the backend
 * chat history endpoints are live.
 */

export const INITIAL_CONVERSATIONS: (Conversation & { category: 'Today' | 'Yesterday' | 'Previous 7 Days' })[] = [
  {
    id: 'conv-001',
    title: 'Policy Eligibility Criteria',
    document_id: 'doc-gov-001',
    document_title: 'National Sovereign AI Policy & Procurement Directive',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    message_count: 4,
    last_message: 'The mandatory air-gap directive specifies that models must run on-premise...',
    category: 'Today',
  },
  {
    id: 'conv-002',
    title: 'Safety Requirements & Isolation',
    document_id: 'doc-mil-002',
    document_title: 'Critical Infrastructure Cyber Defense Manual v4.2',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 82800000).toISOString(),
    message_count: 6,
    last_message: 'SCADA isolation boundary requires hardware data diodes...',
    category: 'Yesterday',
  },
  {
    id: 'conv-003',
    title: 'Technical Analysis - Encryption Standard',
    document_id: 'doc-tech-003',
    document_title: 'Sovereign Vector Pipeline Architecture Whitepaper',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 170000000).toISOString(),
    message_count: 2,
    last_message: 'AES-256-GCM is enforced for all stored ChromaDB collections...',
    category: 'Previous 7 Days',
  },
];

export const SUGGESTED_QUESTIONS: string[] = [
  'Summarize this document',
  'What are the key requirements?',
  'What does section 4 specify?',
  'List all mandatory compliance criteria',
];

export const DEMO_EVIDENCE_CITATIONS: DocumentCitation[] = [
  {
    document_id: 'doc-gov-001',
    document_title: 'National Sovereign AI Policy & Procurement Directive',
    chunk_id: 'chk-gov-001',
    page_number: 1,
    snippet: 'Any generative or semantic retrieval system deployed inside national defense installations must execute exclusively on verified on-premise compute nodes with zero external telemetry egress.',
    relevance_score: 0.96,
  },
  {
    document_id: 'doc-gov-001',
    document_title: 'National Sovereign AI Policy & Procurement Directive',
    chunk_id: 'chk-gov-002',
    page_number: 3,
    snippet: 'Procurement eligibility requires complete architectural sovereignty, local vector storage validation, and air-gapped cryptographic integrity hashing.',
    relevance_score: 0.91,
  },
];

export const MOCK_CONVERSATION_MESSAGES: Record<string, ChatMessage[]> = {
  'conv-001': [
    {
      id: 'msg-mock-1',
      session_id: 'conv-001',
      role: 'user',
      content: 'What are the eligibility requirements for deploying sovereign AI systems under this policy?',
      timestamp: '10:42 AM',
    },
    {
      id: 'msg-mock-2',
      session_id: 'conv-001',
      role: 'assistant',
      content: 'Under the National Sovereign AI Policy & Procurement Directive, all candidate systems must satisfy strict on-premise execution criteria. Specifically, models and retrieval pipelines must run with zero telemetry egress and maintain cryptographically verified vector embeddings within the local enclave.',
      timestamp: '10:43 AM',
      citations: DEMO_EVIDENCE_CITATIONS,
    },
  ],
  'conv-002': [
    {
      id: 'msg-mock-3',
      session_id: 'conv-002',
      role: 'user',
      content: 'What are the isolation and hardware diode requirements?',
      timestamp: 'Yesterday',
    },
    {
      id: 'msg-mock-4',
      session_id: 'conv-002',
      role: 'assistant',
      content: 'Critical infrastructure isolation mandates hardware data diodes on the SCADA telemetry bus to prevent reverse-flow exfiltration. All ingestion nodes must remain physically separated from public-facing interfaces.',
      timestamp: 'Yesterday',
      citations: [
        {
          document_id: 'doc-mil-002',
          document_title: 'Critical Infrastructure Cyber Defense Manual v4.2',
          chunk_id: 'chk-scada-001',
          page_number: 14,
          snippet: 'SCADA telemetry interconnects must terminate at certified unidirectional hardware diodes. Software-only firewall boundaries are non-compliant.',
          relevance_score: 0.95,
        },
      ],
    },
  ],
  'conv-003': [
    {
      id: 'msg-mock-5',
      session_id: 'conv-003',
      role: 'user',
      content: 'What encryption standard is enforced for the local vector store?',
      timestamp: '2 days ago',
    },
    {
      id: 'msg-mock-6',
      session_id: 'conv-003',
      role: 'assistant',
      content: 'The architecture enforces AES-256-GCM authenticated encryption for all stored vector partitions and chunk indexes residing on on-premise NVMe storage.',
      timestamp: '2 days ago',
      citations: [
        {
          document_id: 'doc-tech-003',
          document_title: 'Sovereign Vector Pipeline Architecture Whitepaper',
          chunk_id: 'chk-enc-009',
          page_number: 8,
          snippet: 'All vector indexes and document chunk payloads are encrypted at rest using AES-256-GCM with hardware-backed key derivation.',
          relevance_score: 0.98,
        },
      ],
    },
  ],
};

