# Architecture Summary

High-level system design and patterns derived from the actual repository (no generated scripts or tooling).

## High-Level System Design

- **Type**: Single Spring Boot 3.5.5 (Java 21) application — GraphQL POC wrapping the DigiCert MPKI REST API.
- **Deployment**: One deployable (graphql-poc); no internal service-to-service calls. External call is to DigiCert REST API; optional AWS S3 (CSV) and AWS SSM Parameter Store.
- **Data ownership**: No application database. All certificate data is fetched from DigiCert and optionally exported to S3/local CSV.

## Request Flow

1. **API → Resolver**
   - Client sends GraphQL request to `POST /graphql` (path from `spring.graphql.path`).
   - `CertificateQueryResolver` handles query `certificateSearch` with many optional arguments.
   - Resolver validates required headers: `Cookie`, `Request-ID`; rejects with `AuthenticationException` if missing.

2. **Resolver → Service**
   - Resolver triggers async CSV export via `AsyncCsvExportService.exportCertificatesAsync` (fire-and-forget).
   - Resolver calls `CertificateService.searchCertificates(...)` and returns `Mono<CertificateSearchResult>`.

3. **Service → Client**
   - `CertificateService` chooses:
     - **Single call**: when parallel processing is disabled or `limit <= singleCallThreshold`.
     - **Parallel calls**: batches via `ParallelProcessingConfig` (batch size, max concurrent, timeout, partial-failure-allowed).
   - Each batch is executed via `CertificateRestClient.searchCertificates(...)`.

4. **Client → External API**
   - `CertificateRestClient` builds GET `/certificate-search` with query parameters, sets `Cookie` and `Accept: application/json`.
   - Uses `WebClient` (from `RestClientConfig`) with large buffer (50MB), 2-minute response timeout, connection pooling.
   - Maps 401 → `AuthenticationException`, 400 → `ApiException.badRequest`, other 4xx/5xx → `ApiException`; reports to New Relic (custom events + `noticeError`).

5. **DB**
   - None. No DB in this service.

6. **Events**
   - No Kafka/queues in repo. Async CSV export is in-process (`@Async` + `CompletableFuture`); no outbound event contracts.

## Layering Structure

- **Controller / API layer**: GraphQL only — `CertificateQueryResolver` (`@Controller`), no REST controllers.
- **Service layer**: `CertificateService` (search orchestration), `AsyncCsvExportService` (CSV batching + S3/local), `ParameterStoreService` (SSM read + cache).
- **Client layer**: `CertificateRestClient` (WebClient to DigiCert).
- **Config layer**: `RestClientConfig`, `SimpleGraphQLConfig`, `AsyncConfig`, `TomcatConfig`, `ParallelProcessingConfig`, `CsvExportConfig`, `ParameterStoreConfig`.
- **Model**: `model.dto.*` (CertificateSearchResult, BatchRequest/BatchResult, PageInfo, CertificateEdge/Connection), `model.entity.*` (PublicCertificateDetails, CustomAttribute, CertificateStatus, CertificateIssueType). Entities are JSON/DTOs for REST response mapping, not JPA entities.
- **Exception**: Custom hierarchy under `CertificateException`; mapped to GraphQL errors in `SimpleGraphQLConfig` (DataFetcherExceptionResolverAdapter).

## Design Patterns

- **BFF / API gateway style**: GraphQL as single entry; backend is DigiCert REST.
- **Reactive**: `Mono`/`Flux` in resolver, service, and client; Reactor context propagation enabled in main.
- **Parallel batching**: Large searches split into batches; configurable concurrency and timeout; optional partial failure (merge successful batches).
- **Async fire-and-forget**: CSV export triggered per request on dedicated executor (`csvExportExecutor`); no wait for completion.
- **External config**: AWS Parameter Store for selected keys with fallback from `parameter.fallback.*`; in-memory cache in `ParameterStoreService`.

## Cross-Cutting Concerns

- **Auth**: No application-level auth framework. Validation is header-based: `Cookie` and `Request-ID` required; Cookie forwarded to DigiCert.
- **Logging**: Logback; JSON encoder (logstash-logback-encoder) when profile is not `local`; `LogSanitizer` for sensitive fields; MDC used in client for `digicert.*` and `error.category`.
- **Caching**: No HTTP cache. Parameter Store values cached in memory (`ParameterStoreService`).
- **Retries**: S3 upload in `AsyncCsvExportService` retries once on credential/expired-token style errors by reinitializing S3 client. No generic HTTP retry in WebClient visible in code.
- **Observability**: New Relic (agent + API): custom events (e.g. DigiCertApiError, DigiCertCsvExportError), `noticeError` with custom attributes; actuator health exposed; reactor-core-micrometer for metrics.
- **Error handling**: GraphQL errors via `DataFetcherExceptionResolverAdapter`; CertificateException gets errorCode/errorType extensions; others get generic INTERNAL_ERROR/SYSTEM_ERROR.

## Key File References

| Concern        | File(s) |
|----------------|---------|
| App entry      | `src/main/java/com/digicert/certificate/GraphqlPocApplication.java` |
| GraphQL API    | `src/main/java/com/digicert/certificate/resolver/CertificateQueryResolver.java` |
| Schema         | `src/main/resources/graphql/schema.graphqls` |
| Search logic   | `src/main/java/com/digicert/certificate/service/CertificateService.java` |
| REST client    | `src/main/java/com/digicert/certificate/client/CertificateRestClient.java` |
| GraphQL errors | `src/main/java/com/digicert/certificate/config/SimpleGraphQLConfig.java` |
| WebClient      | `src/main/java/com/digicert/certificate/config/RestClientConfig.java` |
| Logging        | `src/main/resources/logback-spring.xml` |