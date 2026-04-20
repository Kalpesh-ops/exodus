# System Architecture: Exodus load balancer

Exodus orchestrates a secure data pipeline to transform stadium telemetry into cryptographically verifiable user incentives. By coupling serverless API caching with in-memory abuse prevention, the system comfortably scales to stadium-sized bursts of traffic.

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef cdn fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#fff;
    classDef api fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;
    classDef logic fill:#451a03,stroke:#fbbf24,stroke-width:2px,color:#fff;
    classDef google fill:#ffffff,stroke:#ea4335,stroke-width:3px,color:#333;
    classDef db fill:#312e81,stroke:#8b5cf6,stroke-width:2px,color:#fff;

    %% Client Layer
    subgraph Client [User Devices / React Frontend]
        P[Frontend Polling 3s]
        UI[User Requests Claim]
    end

    %% Network & Caching Layer
    subgraph Network [Edge & API]
        SWR((SWR CDN Cache))
        API_GET>GET /api/gates]
        API_POST>POST /api/wallet]
    end

    %% Engine Layer
    subgraph Engine [Internal Processing]
        CE{Congestion Engine}
        RL1[Sliding-Window Rate Limiter]
        RL2[TTL Claim Storage & Dedup]
        JWT[RS256 JWT Generator]
    end

    %% External Services
    subgraph External [Google Services]
        GWALLET[Google Wallet App]
    end

    %% Flow: Polling Gates
    P -- "Requests Data" --> SWR
    SWR -- "Cache Miss" --> API_GET
    API_GET -- "Calculates %" --> CE
    CE -. "Returns: Load & Incentives" .-> SWR
    SWR -- "Cache Hit (Immediate)" --> P

    %% Flow: Claiming Reward
    UI -- "Taps 'Claim'" --> API_POST
    API_POST -- "IP Check" --> RL1
    
    RL1 -- "Blocked" --> REJ1[429 Too Many Requests]
    RL1 -- "Allowed" --> RL2

    RL2 -- "Duplicate" --> REJ2[429 Already Claimed]
    RL2 -- "New Claim" --> JWT

    JWT -- "Signs Claims via Private Key" --> GW[Save Link]
    GW -- "Redirects" --> GWALLET

    %% Assign styles
    class P,UI client;
    class SWR cdn;
    class API_GET,API_POST api;
    class CE,RL1,RL2 logic;
    class JWT,GW,GWALLET google;
```

## Component Interplay
1. **Frontend Polling & SWR Cache:** The React frontend polls `GET /api/gates` every 3 seconds. To prevent the server from melting under simultaneous requests from 80,000 users, the response is aggressively cached via `stale-while-revalidate` CDN directives.
2. **Congestion Engine:** Pure utility functions calculate current crowd density against physical gate capacity. If capacity exceeds configured thresholds (>70% or >85%), it automatically dictates delay timings and reward tiers.
3. **In-Memory Rate Limiter:** `POST /api/wallet` intercepts traffic through an IP-based sliding window and a short-lived TTL claims cache, neutralizing rapid-fire abuse or malicious bot networks.
4. **Wallet Pass Generator:** Validated requests trigger the issuance of a customized Generic Pass mapped to our `ISSUER_ID` and `CLASS_ID`. An RS256 token is signed using server-side service credentials and returned as an actionable link, transferring the incentive directly into the user's Google Wallet.
