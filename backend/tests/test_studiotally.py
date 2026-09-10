"""StudioTally Pro backend API + WebSocket tests"""
import asyncio
import json
import uuid

import pytest
import websockets


# ------------------ REST tests ------------------

class TestSessionsREST:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert "StudioTally" in r.json().get("message", "")

    def test_create_session_returns_5char_code(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/sessions", json={"name": "TEST_Studio"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "code" in data and isinstance(data["code"], str)
        assert len(data["code"]) == 5
        assert "_id" not in data
        assert data["name"] == "TEST_Studio"

    def test_get_session_snapshot_ok(self, api_client, base_url):
        c = api_client.post(f"{base_url}/api/sessions", json={"name": "TEST_S"}).json()["code"]
        r = api_client.get(f"{base_url}/api/sessions/{c}")
        assert r.status_code == 200
        snap = r.json()
        assert snap["code"] == c
        assert snap["devices"] == []

    def test_get_session_unknown_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/sessions/ZZZZZ")
        assert r.status_code == 404

    def test_join_upserts_and_returns_devices(self, api_client, base_url):
        code = api_client.post(f"{base_url}/api/sessions", json={}).json()["code"]
        did = str(uuid.uuid4())
        r = api_client.post(
            f"{base_url}/api/sessions/{code}/join",
            json={"device_id": did, "name": "TEST_CamA", "role": "camera"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["code"] == code
        assert any(d["id"] == did and d["name"] == "TEST_CamA" for d in data["devices"])
        # Upsert: rejoin with new name
        r2 = api_client.post(
            f"{base_url}/api/sessions/{code}/join",
            json={"device_id": did, "name": "TEST_CamA2", "role": "camera"},
        )
        assert r2.status_code == 200
        d = next(x for x in r2.json()["devices"] if x["id"] == did)
        assert d["name"] == "TEST_CamA2"

    def test_set_state_updates_device(self, api_client, base_url):
        code = api_client.post(f"{base_url}/api/sessions", json={}).json()["code"]
        did = str(uuid.uuid4())
        api_client.post(
            f"{base_url}/api/sessions/{code}/join",
            json={"device_id": did, "name": "TEST_Cam", "role": "camera"},
        )
        r = api_client.post(
            f"{base_url}/api/sessions/{code}/state",
            json={"target_id": did, "state": "live"},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True
        snap = api_client.get(f"{base_url}/api/sessions/{code}").json()
        d = next(x for x in snap["devices"] if x["id"] == did)
        assert d["state"] == "live"

    def test_alarm_returns_ok(self, api_client, base_url):
        code = api_client.post(f"{base_url}/api/sessions", json={}).json()["code"]
        r = api_client.post(
            f"{base_url}/api/sessions/{code}/alarm",
            json={"target_id": "all", "message": "TEST_alerte"},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ------------------ WebSocket tests ------------------

async def _recv_json(ws, timeout=5.0):
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def _drain(ws, until_type=None, timeout=3.0, collect=False):
    """Read messages until until_type is seen or timeout. Returns list if collect=True."""
    msgs = []
    end = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = end - asyncio.get_event_loop().time()
        if remaining <= 0:
            break
        try:
            m = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            break
        try:
            j = json.loads(m)
        except Exception:
            continue
        msgs.append(j)
        if until_type and j.get("type") == until_type:
            if not collect:
                return j
            return msgs
    return msgs if collect else None


@pytest.mark.asyncio
class TestWebsocket:
    async def _create(self, base_url):
        import requests
        r = requests.post(f"{base_url}/api/sessions", json={"name": "TEST_WS"})
        return r.json()["code"]

    async def test_snapshot_on_connect(self, base_url, ws_base_url):
        code = await self._create(base_url)
        did = str(uuid.uuid4())
        url = f"{ws_base_url}/api/ws/{code}/{did}?name=TEST_A&role=camera"
        async with websockets.connect(url) as ws:
            snap = await _recv_json(ws)
            assert snap["type"] == "snapshot"
            assert snap["code"] == code
            assert any(d["id"] == did for d in snap["devices"])

    async def test_device_list_on_second_join(self, base_url, ws_base_url):
        code = await self._create(base_url)
        did_a = str(uuid.uuid4())
        did_b = str(uuid.uuid4())
        url_a = f"{ws_base_url}/api/ws/{code}/{did_a}?name=TEST_A&role=camera"
        url_b = f"{ws_base_url}/api/ws/{code}/{did_b}?name=TEST_B&role=camera"
        async with websockets.connect(url_a) as wsa:
            # consume A's snapshot + own device_list
            await _drain(wsa, until_type="device_list", timeout=3.0)
            async with websockets.connect(url_b) as wsb:
                # A should receive a device_list broadcast containing B
                got = await _drain(wsa, until_type="device_list", timeout=5.0)
                assert got is not None, "A did not get device_list"
                ids = {d["id"] for d in got["devices"]}
                assert did_a in ids and did_b in ids

    async def test_set_state_broadcasts(self, base_url, ws_base_url):
        code = await self._create(base_url)
        did_a = str(uuid.uuid4())
        did_b = str(uuid.uuid4())
        url_a = f"{ws_base_url}/api/ws/{code}/{did_a}?name=TEST_A"
        url_b = f"{ws_base_url}/api/ws/{code}/{did_b}?name=TEST_B"
        async with websockets.connect(url_a) as wsa, websockets.connect(url_b) as wsb:
            await _drain(wsa, until_type="device_list", timeout=3.0)
            await _drain(wsb, until_type="device_list", timeout=3.0)
            await wsa.send(json.dumps({"type": "set_state", "target_id": did_b, "state": "live"}))
            got = await _drain(wsb, until_type="device_list", timeout=5.0)
            assert got is not None
            b_dev = next(d for d in got["devices"] if d["id"] == did_b)
            assert b_dev["state"] == "live"

    async def test_alarm_targeted_delivery(self, base_url, ws_base_url):
        """A sends alarm to B; B receives, A does NOT."""
        code = await self._create(base_url)
        did_a = str(uuid.uuid4())
        did_b = str(uuid.uuid4())
        async with websockets.connect(
            f"{ws_base_url}/api/ws/{code}/{did_a}?name=TEST_A"
        ) as wsa, websockets.connect(
            f"{ws_base_url}/api/ws/{code}/{did_b}?name=TEST_B"
        ) as wsb:
            await _drain(wsa, until_type="device_list", timeout=3.0)
            await _drain(wsb, until_type="device_list", timeout=3.0)
            await wsa.send(json.dumps({
                "type": "alarm", "target_id": did_b, "message": "TEST_ping",
                "sound": True, "vibrate": True, "flash": True,
            }))
            # B should get an alarm
            got_b = await _drain(wsb, until_type="alarm", timeout=5.0)
            assert got_b is not None
            assert got_b["message"] == "TEST_ping"
            # A should NOT receive alarm within 1.5s
            msgs_a = await _drain(wsa, timeout=1.5, collect=True) or []
            assert not any(m.get("type") == "alarm" for m in msgs_a), (
                f"Sender A wrongly received alarm: {msgs_a}"
            )

    async def test_ws_unknown_session_closes(self, ws_base_url):
        did = str(uuid.uuid4())
        url = f"{ws_base_url}/api/ws/ZZZZZ/{did}?name=TEST_X"
        with pytest.raises(Exception):
            async with websockets.connect(url) as ws:
                # server closes with 4404; recv should fail
                await asyncio.wait_for(ws.recv(), timeout=5.0)
