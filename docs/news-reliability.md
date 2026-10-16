# News collection and fallback

The app first reads the public `news-data/news.json` snapshot from this repository. When every requested general feed was collected within 30 minutes, no publisher requests are made by the Worker. Otherwise, direct publisher requests have an eight-second deadline and failed feeds use snapshot articles collected within the last 24 hours. Stale responses include a warning and collection time. No portfolio symbols are sent to the snapshot host.

`.github/workflows/collect-news.yml` collects TRT Haber economy and European Central Bank press RSS feeds on a GitHub runner approximately every 20 minutes. Scheduled Actions can be delayed. Successful collections update the isolated `news-data` branch without triggering the app's main-branch deployment. Failed categories retain their previous collection timestamps, and a total failure leaves the previous snapshot untouched and fails the job visibly.

## Activation

1. Merge the workflow and application changes into the default branch.
2. Run **Collect news** once through Actions → Run workflow to create the initial `news-data` branch.
3. Verify the job is successful and `/api/news` returns a non-empty list and `collectedAt`.
4. Confirm the application deployment succeeded. A failed collector or an empty/new repository cannot supply cached news; the app retains its explicit error state when neither source works.

No new API token is required: the workflow uses GitHub's built-in token with repository contents permission. Repository settings must allow that permission. The snapshot includes only public article metadata and links, not user portfolio data.

## Diagnosis

Structured `news_upstream_failed` logs include category, request stage, elapsed time, HTTP status when available, content type, and error name. They do not log user symbols or complete upstream responses. `news_snapshot_failed` identifies network errors fetching the independent snapshot.

A temporary plain Worker tested Google RSS directly and timed out after eight seconds. The same source responded from the local machine. This rules out Next/OpenNext caching as a necessary cause of that failure; it does not establish whether Google is blocking Worker IPs or whether the route is simply too slow. The temporary Worker was deleted after the test.

## Sources

The shared registry in `src/lib/news/feeds.ts` lists the enabled official publisher endpoints. The collector and live API use the same registry and classification. TRT economy covers Turkish macroeconomic news and stock-market headlines; ECB press releases cover European policy in their original language. No Google RSS is used. NTV and Fed are not enabled because the access test returned HTTP 403. Official KAP integration is pending; the KAP tab explicitly explains that status and never relabels a publisher article as a disclosure.

Each article carries a feed ID. Snapshot validation accepts only enabled publishers. When one feed fails, its prior snapshot is retained independently from other publishers, with its original timestamp. Switching providers cannot revive an old Google snapshot.

## Sentiment

`src/lib/news/sentiment.ts` is shared by the live API and scheduled collector. The API recalculates snapshot labels so older classifications do not survive a rule update. The classifier uses explicit financial phrases in Turkish and English, treats ambiguous or mixed signals as neutral, and skips negated, forecast and question clauses. Generic words such as "karar", "rekor" or "artış" alone cannot mark a story positive. Interest-rate changes alone are neutral because their effects depend on the asset and expectations. Labels describe text tone, not investment signals; this remains a conservative rule-based classifier rather than a semantic AI model.
