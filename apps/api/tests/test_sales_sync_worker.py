import pytest

from worker.tasks import product_sync as worker_sync


def test_sync_products_for_tenant_retry_on_error(monkeypatch):
    class _RetryCalled(Exception):
        pass

    def _raise(coro, *args, **kwargs):  # noqa: ANN001
        try:
            coro.close()
        except Exception:
            pass
        raise RuntimeError("boom")

    def _retry(exc, countdown):  # noqa: ANN001
        raise _RetryCalled((str(exc), countdown))

    monkeypatch.setattr(worker_sync, "run_async_task", _raise)
    monkeypatch.setattr(worker_sync.sync_products_for_tenant, "retry", _retry)
    with pytest.raises(_RetryCalled) as ei:
        worker_sync.sync_products_for_tenant.run("550e8400-e29b-41d4-a716-446655440000")
    msg, countdown = ei.value.args[0]
    assert "boom" in msg
    assert countdown == 60


def test_sync_all_active_collects_partial_failures(monkeypatch):
    class _ConnectorRow:
        def __init__(self, tenant_id, platform):
            self.tenant_id = tenant_id
            self.platform = platform

    class _Result:
        def scalars(self):
            class _S:
                @staticmethod
                def all():
                    return [
                        _ConnectorRow("550e8400-e29b-41d4-a716-446655440000", "woocommerce"),
                        _ConnectorRow("550e8400-e29b-41d4-a716-446655440111", "shopify"),
                    ]

            return _S()

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        async def execute(self, _):
            return _Result()

    class _SessionFactory:
        def __call__(self):
            return _Session()

    async def _sync_one(tenant_id, platform, index_qdrant):  # noqa: ANN001
        if platform == "shopify":
            raise RuntimeError("skip")
        return 3

    monkeypatch.setattr(worker_sync, "async_session", _SessionFactory())
    monkeypatch.setattr(worker_sync, "_sync_tenant_platform", _sync_one)
    total = worker_sync.run_async_task(worker_sync._sync_all_active_async())
    assert total == 3
