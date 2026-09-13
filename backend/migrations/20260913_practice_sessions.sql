BEGIN;

CREATE TABLE practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    course_id UUID NOT NULL
        REFERENCES courses(id)
        ON DELETE CASCADE,

    topic_id UUID
        REFERENCES topics(id)
        ON DELETE SET NULL,

    mode VARCHAR(30) NOT NULL DEFAULT 'quick',

    difficulty VARCHAR(20) NOT NULL DEFAULT 'mixed',

    question_count SMALLINT NOT NULL DEFAULT 10,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    correct_count SMALLINT NOT NULL DEFAULT 0,

    wrong_count SMALLINT NOT NULL DEFAULT 0,

    answered_count SMALLINT NOT NULL DEFAULT 0,

    accuracy NUMERIC(5,2),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    duration_seconds INTEGER,

    CONSTRAINT practice_sessions_mode_check
        CHECK (mode IN (
            'quick',
            'weak_topics',
            'past_questions'
        )),

    CONSTRAINT practice_sessions_difficulty_check
        CHECK (difficulty IN (
            'mixed',
            'easy',
            'medium',
            'hard'
        )),

    CONSTRAINT practice_sessions_status_check
        CHECK (status IN (
            'active',
            'completed',
            'abandoned'
        )),

    CONSTRAINT practice_sessions_question_count_check
        CHECK (question_count BETWEEN 1 AND 100),

    CONSTRAINT practice_sessions_accuracy_check
        CHECK (
            accuracy IS NULL
            OR (accuracy >= 0 AND accuracy <= 100)
        )
);

CREATE TABLE practice_session_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL
        REFERENCES practice_sessions(id)
        ON DELETE CASCADE,

    question_id UUID NOT NULL
        REFERENCES questions(id)
        ON DELETE RESTRICT,

    position SMALLINT NOT NULL,

    student_answer TEXT,

    is_correct BOOLEAN,

    presented_at TIMESTAMPTZ,

    answered_at TIMESTAMPTZ,

    response_time_ms INTEGER,

    UNIQUE (session_id, question_id),

    UNIQUE (session_id, position)
);

CREATE INDEX idx_practice_sessions_user
    ON practice_sessions(user_id);

CREATE INDEX idx_practice_sessions_course
    ON practice_sessions(course_id);

CREATE INDEX idx_practice_sessions_user_status
    ON practice_sessions(user_id, status);

CREATE INDEX idx_practice_sessions_completed
    ON practice_sessions(user_id, completed_at DESC);

CREATE INDEX idx_practice_session_questions_session
    ON practice_session_questions(session_id);

COMMIT;
