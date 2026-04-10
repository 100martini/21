import os
from typing import List, Optional, Dict, Any

import asyncpg


MAIN_DATABASE_URL = os.getenv(
    "MAIN_DATABASE_URL",
    "postgresql://postgres:postgres@postgres:5432/trandenden",
)


async def get_team_for_user_and_project(
    user_id: int, project_slug: str
) -> Optional[Dict[str, Any]]:
    """
    Returns:
        {
          "team_id": int,
          "team_name": str,
          "project_slug": str,
          "project_name": str,
          "member_ids": List[int],
        }
    """
    if not MAIN_DATABASE_URL:
        return None

    conn = await asyncpg.connect(MAIN_DATABASE_URL)
    try:
        team_row = await conn.fetchrow(
            """
            SELECT
              t.id AS team_id,
              t.name AS team_name,
              p.slug AS project_slug,
              p.name AS project_name
            FROM "Team" t
            JOIN "Project" p ON p.id = t."projectId"
            WHERE
              p.slug = $1
              AND t.status = 'approved'
              AND EXISTS (
                SELECT 1
                FROM "TeamMember" tm
                WHERE
                  tm."teamId" = t.id
                  AND tm."userId" = $2
                  AND tm.status = 'approved'
              )
            LIMIT 1
            """,
            project_slug,
            user_id,
        )

        if not team_row:
            return None

        team_id = team_row["team_id"]

        member_rows = await conn.fetch(
            """
            SELECT tm."userId" AS user_id
            FROM "TeamMember" tm
            WHERE tm."teamId" = $1 AND tm.status = 'approved'
            """,
            team_id,
        )
        member_ids: List[int] = [int(r["user_id"]) for r in member_rows]

        return {
            "team_id": int(team_row["team_id"]),
            "team_name": team_row["team_name"],
            "project_slug": team_row["project_slug"],
            "project_name": team_row["project_name"],
            "member_ids": member_ids,
        }
    finally:
        await conn.close()


async def get_all_teams_for_user(user_id: int) -> List[Dict[str, Any]]:

    if not MAIN_DATABASE_URL:
        return []

    conn = await asyncpg.connect(MAIN_DATABASE_URL)
    results = []
    try:
        team_rows = await conn.fetch(
            """
            SELECT
              t.id AS team_id,
              t.name AS team_name,
              p.slug AS project_slug,
              p.name AS project_name
            FROM "Team" t
            JOIN "Project" p ON p.id = t."projectId"
            JOIN "TeamMember" currentUserTm ON currentUserTm."teamId" = t.id
            WHERE
              currentUserTm."userId" = $1
              AND currentUserTm.status = 'approved'
            """,
            user_id,
        )

        for row in team_rows:
            team_id = row["team_id"]
            member_rows = await conn.fetch(
                """
                SELECT tm."userId" AS user_id
                FROM "TeamMember" tm
                WHERE tm."teamId" = $1
                """,
                team_id,
            )
            member_ids = [int(r["user_id"]) for r in member_rows]

            results.append({
                "team_id": int(team_id),
                "team_name": row["team_name"],
                "project_slug": row["project_slug"],
                "project_name": row["project_name"],
                "member_ids": member_ids,
            })
        return results
    except Exception as e:
        print(f"Error fetching all teams: {e}")
        return []
    finally:
        await conn.close()


async def search_intra_users(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    if not MAIN_DATABASE_URL:
        return []

    conn = await asyncpg.connect(MAIN_DATABASE_URL)
    try:
        search_pattern = f"%{query}%"
        rows = await conn.fetch(
            """
            SELECT id, login, "displayName", nickname, avatar 
            FROM "User"
            WHERE login ILIKE $1 OR "displayName" ILIKE $1 OR nickname ILIKE $1
            LIMIT $2
            """,
            search_pattern,
            limit
        )

        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error searching intra users: {e}")
        return []
    finally:
        await conn.close()


async def get_user_friends(user_id: int) -> List[Dict[str, Any]]:
    if not MAIN_DATABASE_URL:
        return []

    conn = await asyncpg.connect(MAIN_DATABASE_URL)
    try:

        rows = await conn.fetch(
            """
            SELECT
                f.id AS friendship_id,
                u.id AS friend_id,
                u.login AS friend_login,
                u."displayName" AS friend_display_name,
                u.avatar AS friend_avatar,
                u.nickname AS friend_nickname
            FROM "Friendship" f
            JOIN "User" u ON (u.id = f."addresseeId" OR u.id = f."requesterId") AND u.id != $1
            WHERE (f."requesterId" = $1 OR f."addresseeId" = $1)
              AND f.status ILIKE 'accepted'
            """,
            user_id
        )
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error fetching friends: {e}")
        return []
    finally:
        await conn.close()


async def get_user_login(user_id: int) -> Optional[str]:
    if not MAIN_DATABASE_URL:
        return None
    conn = await asyncpg.connect(MAIN_DATABASE_URL)
    try:
        row = await conn.fetchrow('SELECT login FROM "User" WHERE id = $1', user_id)
        return row["login"] if row else None
    except Exception as e:
        print(f"Error fetching user login: {e}")
        return None
    finally:
        await conn.close()


async def get_user_avatar(user_id: int) -> Optional[str]:
    if not MAIN_DATABASE_URL:
        return None
    conn = await asyncpg.connect(MAIN_DATABASE_URL)
    try:
        row = await conn.fetchrow(
            'SELECT "customAvatar", avatar FROM "User" WHERE id = $1', user_id
        )
        if not row:
            return None
        return row["customAvatar"] or row["avatar"]
    except Exception as e:
        print(f"Error fetching user avatar: {e}")
        return None
    finally:
        await conn.close()
