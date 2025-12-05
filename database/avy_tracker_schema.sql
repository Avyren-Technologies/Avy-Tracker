--
-- PostgreSQL database dump
--

\restrict vcugLsfSli4CDWxTXDL1YcomECGvsvgwIDP1ZaofeyZ1ANX2jC1gdXjZjtUYMwy

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: avnadmin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO avnadmin;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: avnadmin
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO avnadmin;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: avnadmin
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: check_group_admin_role(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.check_group_admin_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM users 
              WHERE id = NEW.group_admin_id 
              AND role = 'group-admin'
          ) THEN
              RAISE EXCEPTION 'User % is not a group admin', NEW.group_admin_id;
          END IF;
          RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.check_group_admin_role() OWNER TO avnadmin;

--
-- Name: cleanup_expired_mfa_otps(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_expired_mfa_otps() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE users 
    SET mfa_otp = NULL, 
        mfa_otp_expires = NULL, 
        mfa_otp_attempts = 0
    WHERE mfa_otp_expires < NOW();
END;
$$;


ALTER FUNCTION public.cleanup_expired_mfa_otps() OWNER TO avnadmin;

--
-- Name: cleanup_expired_otp_records(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_expired_otp_records() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired OTP records (older than 24 hours)
  DELETE FROM otp_records 
  WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
     OR (is_used = true AND verified_at < CURRENT_TIMESTAMP - INTERVAL '1 hour');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up old SMS delivery logs (older than 30 days)
  DELETE FROM sms_delivery_log 
  WHERE sent_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
  
  -- Clean up expired rate limits
  DELETE FROM otp_rate_limits 
  WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < CURRENT_TIMESTAMP);
  
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_otp_records() OWNER TO avnadmin;

--
-- Name: cleanup_old_error_logs(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_old_error_logs() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM error_logs
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION public.cleanup_old_error_logs() OWNER TO avnadmin;

--
-- Name: cleanup_old_error_logs(integer); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_old_error_logs(retention_days integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM error_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$;


ALTER FUNCTION public.cleanup_old_error_logs(retention_days integer) OWNER TO avnadmin;

--
-- Name: cleanup_old_task_activity(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_old_task_activity() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM task_activity_history 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_task_activity() OWNER TO avnadmin;

--
-- Name: cleanup_old_task_notifications(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_old_task_notifications() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM task_notifications 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '3 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_task_notifications() OWNER TO avnadmin;

--
-- Name: get_error_frequency(timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.get_error_frequency(start_date timestamp without time zone, end_date timestamp without time zone) RETURNS TABLE(error_type text, frequency bigint, first_occurrence timestamp without time zone, last_occurrence timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.error_type,
        COUNT(*) as frequency,
        MIN(e.timestamp) as first_occurrence,
        MAX(e.timestamp) as last_occurrence
    FROM error_logs e
    WHERE e.timestamp BETWEEN start_date AND end_date
    GROUP BY e.error_type
    ORDER BY frequency DESC;
END;
$$;


ALTER FUNCTION public.get_error_frequency(start_date timestamp without time zone, end_date timestamp without time zone) OWNER TO avnadmin;

--
-- Name: log_task_activity(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.log_task_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    activity_desc TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Determine activity type and description based on what changed
    IF TG_OP = 'INSERT' THEN
        activity_desc := 'Task created: ' || NEW.title;
        INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, new_value)
        VALUES (NEW.id, NEW.assigned_by, 'task_created', activity_desc, NEW.title);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Status change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            activity_desc := 'Status changed from ' || OLD.status || ' to ' || NEW.status;
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'status_changed', activity_desc, OLD.status, NEW.status);
        END IF;
        
        -- Priority change
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            activity_desc := 'Priority changed from ' || OLD.priority || ' to ' || NEW.priority;
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'priority_changed', activity_desc, OLD.priority, NEW.priority);
        END IF;
        
        -- Assignment change
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            activity_desc := 'Task reassigned';
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'task_reassigned', activity_desc, OLD.assigned_to::text, NEW.assigned_to::text);
        END IF;
        
        -- Due date change
        IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
            activity_desc := 'Due date updated';
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'due_date_changed', activity_desc, 
                   COALESCE(OLD.due_date::text, 'Not set'), 
                   COALESCE(NEW.due_date::text, 'Not set'));
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.log_task_activity() OWNER TO avnadmin;

--
-- Name: schedule_error_logs_cleanup(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.schedule_error_logs_cleanup() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM cron.schedule('0 0 * * *', 'SELECT cleanup_old_error_logs()');
    END;
    $$;


ALTER FUNCTION public.schedule_error_logs_cleanup() OWNER TO avnadmin;

--
-- Name: update_auto_ended_shift(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_auto_ended_shift() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only update if the shift was auto-ended and the status wasn't updated
    IF NEW.ended_automatically = TRUE AND NEW.status = 'active' THEN
        NEW.status := 'completed';
        NEW.duration := NEW.end_time - NEW.start_time;
        NEW.updated_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_auto_ended_shift() OWNER TO avnadmin;

--
-- Name: update_company_holidays_updated_at(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_company_holidays_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_company_holidays_updated_at() OWNER TO avnadmin;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO avnadmin;

--
-- Name: update_regularization_updated_at_column(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_regularization_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_regularization_updated_at_column() OWNER TO avnadmin;

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp() OWNER TO avnadmin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO avnadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approval_levels; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.approval_levels (
    id integer NOT NULL,
    company_id integer NOT NULL,
    level_name character varying(50) NOT NULL,
    level_order integer NOT NULL,
    role character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.approval_levels OWNER TO avnadmin;

--
-- Name: approval_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.approval_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.approval_levels_id_seq OWNER TO avnadmin;

--
-- Name: approval_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.approval_levels_id_seq OWNED BY public.approval_levels.id;


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.approval_workflows (
    id integer NOT NULL,
    company_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    min_days integer DEFAULT 1 NOT NULL,
    max_days integer,
    requires_all_levels boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.approval_workflows OWNER TO avnadmin;

--
-- Name: approval_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.approval_workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.approval_workflows_id_seq OWNER TO avnadmin;

--
-- Name: approval_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.approval_workflows_id_seq OWNED BY public.approval_workflows.id;


--
-- Name: attendance_regularization_requests; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.attendance_regularization_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    shift_id integer,
    request_date date NOT NULL,
    original_start_time timestamp with time zone,
    original_end_time timestamp with time zone,
    requested_start_time timestamp with time zone NOT NULL,
    requested_end_time timestamp with time zone NOT NULL,
    reason text NOT NULL,
    supporting_documents text[],
    request_type character varying(50) DEFAULT 'time_adjustment'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    current_approver_role character varying(20),
    group_admin_id integer,
    group_admin_approved_at timestamp with time zone,
    group_admin_comments text,
    management_id integer,
    management_approved_at timestamp with time zone,
    management_comments text,
    final_approved_by integer,
    final_approved_at timestamp with time zone,
    final_comments text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer NOT NULL,
    CONSTRAINT chk_approver_role_valid CHECK (((current_approver_role)::text = ANY ((ARRAY['group-admin'::character varying, 'management'::character varying])::text[]))),
    CONSTRAINT chk_request_type_valid CHECK (((request_type)::text = ANY ((ARRAY['time_adjustment'::character varying, 'missing_shift'::character varying, 'early_departure'::character varying, 'late_arrival'::character varying])::text[]))),
    CONSTRAINT chk_requested_times_valid CHECK ((requested_end_time > requested_start_time)),
    CONSTRAINT chk_status_valid CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'group_admin_approved'::character varying, 'management_approved'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.attendance_regularization_requests OWNER TO avnadmin;

--
-- Name: TABLE attendance_regularization_requests; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.attendance_regularization_requests IS 'Main table for attendance regularization requests with approval workflow';


--
-- Name: COLUMN attendance_regularization_requests.request_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.attendance_regularization_requests.request_type IS 'Type of regularization: time_adjustment, missing_shift, early_departure, late_arrival';


--
-- Name: COLUMN attendance_regularization_requests.status; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.attendance_regularization_requests.status IS 'Current status in approval workflow';


--
-- Name: COLUMN attendance_regularization_requests.current_approver_role; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.attendance_regularization_requests.current_approver_role IS 'Role of the current approver in the workflow';


--
-- Name: attendance_regularization_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.attendance_regularization_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_regularization_requests_id_seq OWNER TO avnadmin;

--
-- Name: attendance_regularization_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.attendance_regularization_requests_id_seq OWNED BY public.attendance_regularization_requests.id;


--
-- Name: biometric_audit_logs; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.biometric_audit_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    action_type character varying(30) NOT NULL,
    action_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    performed_by integer,
    ip_address inet,
    user_agent text,
    device_fingerprint text,
    location_data jsonb,
    compliance_flags jsonb DEFAULT '{}'::jsonb,
    retention_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT biometric_audit_logs_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['profile_created'::character varying, 'profile_updated'::character varying, 'profile_deleted'::character varying, 'profile_accessed'::character varying, 'verification_attempt'::character varying, 'settings_accessed'::character varying, 'data_exported'::character varying, 'consent_given'::character varying, 'consent_revoked'::character varying, 'data_retention_applied'::character varying, 'security_breach_detected'::character varying])::text[])))
);


ALTER TABLE public.biometric_audit_logs OWNER TO avnadmin;

--
-- Name: TABLE biometric_audit_logs; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.biometric_audit_logs IS 'Compliance and security audit trail for all biometric data operations';


--
-- Name: COLUMN biometric_audit_logs.compliance_flags; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.biometric_audit_logs.compliance_flags IS 'GDPR, CCPA and other compliance markers and metadata';


--
-- Name: biometric_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.biometric_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.biometric_audit_logs_id_seq OWNER TO avnadmin;

--
-- Name: biometric_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.biometric_audit_logs_id_seq OWNED BY public.biometric_audit_logs.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_messages OWNER TO avnadmin;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO avnadmin;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20),
    address text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_limit integer DEFAULT 100 NOT NULL,
    pending_users integer DEFAULT 0 NOT NULL,
    logo bytea,
    CONSTRAINT companies_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('disabled'::character varying)::text])))
);


ALTER TABLE public.companies OWNER TO avnadmin;

--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.companies_id_seq OWNER TO avnadmin;

--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: company_default_leave_balances; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.company_default_leave_balances (
    id integer NOT NULL,
    company_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    role character varying(32) NOT NULL,
    default_days integer NOT NULL,
    carry_forward_days integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT company_default_leave_balances_role_check CHECK (((role)::text = ANY (ARRAY[('management'::character varying)::text, ('group_admin'::character varying)::text, ('employee'::character varying)::text])))
);


ALTER TABLE public.company_default_leave_balances OWNER TO avnadmin;

--
-- Name: company_default_leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_default_leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_default_leave_balances_id_seq OWNER TO avnadmin;

--
-- Name: company_default_leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_default_leave_balances_id_seq OWNED BY public.company_default_leave_balances.id;


--
-- Name: company_geofences; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.company_geofences (
    id integer NOT NULL,
    company_id integer,
    name character varying(100) NOT NULL,
    coordinates public.geography(Point,4326) NOT NULL,
    radius numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


ALTER TABLE public.company_geofences OWNER TO avnadmin;

--
-- Name: company_geofences_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_geofences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_geofences_id_seq OWNER TO avnadmin;

--
-- Name: company_geofences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_geofences_id_seq OWNED BY public.company_geofences.id;


--
-- Name: company_geofences_new_id_seq1; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_geofences_new_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_geofences_new_id_seq1 OWNER TO avnadmin;

--
-- Name: company_geofences_new_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_geofences_new_id_seq1 OWNED BY public.company_geofences.id;


--
-- Name: company_holidays; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.company_holidays (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(100) NOT NULL,
    date date NOT NULL,
    is_full_day boolean DEFAULT true,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    updated_by integer
);


ALTER TABLE public.company_holidays OWNER TO avnadmin;

--
-- Name: TABLE company_holidays; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.company_holidays IS 'Stores company-specific holidays for calendar functionality';


--
-- Name: COLUMN company_holidays.id; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.id IS 'Primary key for the holiday record';


--
-- Name: COLUMN company_holidays.company_id; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.company_id IS 'Foreign key to companies table';


--
-- Name: COLUMN company_holidays.name; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.name IS 'Name of the holiday';


--
-- Name: COLUMN company_holidays.date; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.date IS 'Date of the holiday';


--
-- Name: COLUMN company_holidays.is_full_day; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.is_full_day IS 'Whether this is a full day holiday (true) or partial day (false)';


--
-- Name: COLUMN company_holidays.description; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.description IS 'Optional description of the holiday';


--
-- Name: COLUMN company_holidays.is_active; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.is_active IS 'Whether this holiday is currently active';


--
-- Name: COLUMN company_holidays.created_at; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.created_at IS 'Timestamp when the record was created';


--
-- Name: COLUMN company_holidays.updated_at; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.updated_at IS 'Timestamp when the record was last updated';


--
-- Name: COLUMN company_holidays.created_by; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.created_by IS 'User ID who created this holiday record';


--
-- Name: COLUMN company_holidays.updated_by; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.company_holidays.updated_by IS 'User ID who last updated this holiday record';


--
-- Name: company_holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_holidays_id_seq OWNER TO avnadmin;

--
-- Name: company_holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_holidays_id_seq OWNED BY public.company_holidays.id;


--
-- Name: company_tracking_settings; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.company_tracking_settings (
    id integer NOT NULL,
    company_id integer,
    update_interval_seconds integer DEFAULT 30,
    battery_saving_enabled boolean DEFAULT true,
    indoor_tracking_enabled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    default_tracking_precision character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    CONSTRAINT company_tracking_settings_default_tracking_precision_check CHECK (((default_tracking_precision)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text])))
);


ALTER TABLE public.company_tracking_settings OWNER TO avnadmin;

--
-- Name: company_tracking_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_tracking_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_tracking_settings_id_seq OWNER TO avnadmin;

--
-- Name: company_tracking_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_tracking_settings_id_seq OWNED BY public.company_tracking_settings.id;


--
-- Name: customer_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.customer_notifications (
    id integer NOT NULL,
    customer_email character varying(255) NOT NULL,
    task_title character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customer_notifications OWNER TO avnadmin;

--
-- Name: TABLE customer_notifications; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.customer_notifications IS 'Tracks customer notifications sent for task updates';


--
-- Name: COLUMN customer_notifications.customer_email; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.customer_notifications.customer_email IS 'Email address of the customer who received the notification';


--
-- Name: COLUMN customer_notifications.task_title; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.customer_notifications.task_title IS 'Title of the task for which notification was sent';


--
-- Name: COLUMN customer_notifications.status; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.customer_notifications.status IS 'Status of the task when notification was sent';


--
-- Name: COLUMN customer_notifications.type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.customer_notifications.type IS 'Type of notification (status_update, task_assignment, etc.)';


--
-- Name: COLUMN customer_notifications.sent_at; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.customer_notifications.sent_at IS 'Timestamp when the notification was sent';


--
-- Name: customer_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.customer_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_notifications_id_seq OWNER TO avnadmin;

--
-- Name: customer_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.customer_notifications_id_seq OWNED BY public.customer_notifications.id;


--
-- Name: device_fingerprints; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.device_fingerprints (
    id integer NOT NULL,
    user_id integer NOT NULL,
    fingerprint_hash text NOT NULL,
    device_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    first_seen timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_trusted boolean DEFAULT false,
    risk_score integer DEFAULT 0,
    blocked boolean DEFAULT false,
    block_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT device_fingerprints_risk_score_check CHECK (((risk_score >= 0) AND (risk_score <= 100)))
);


ALTER TABLE public.device_fingerprints OWNER TO avnadmin;

--
-- Name: TABLE device_fingerprints; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.device_fingerprints IS 'Device tracking and validation for fraud detection and security';


--
-- Name: device_fingerprints_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.device_fingerprints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_fingerprints_id_seq OWNER TO avnadmin;

--
-- Name: device_fingerprints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.device_fingerprints_id_seq OWNED BY public.device_fingerprints.id;


--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.device_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    device_type character varying(20) NOT NULL,
    device_name character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    CONSTRAINT device_tokens_device_type_check CHECK (((device_type)::text = ANY (ARRAY[('ios'::character varying)::text, ('android'::character varying)::text, ('web'::character varying)::text])))
);


ALTER TABLE public.device_tokens OWNER TO avnadmin;

--
-- Name: device_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.device_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_tokens_id_seq OWNER TO avnadmin;

--
-- Name: device_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.device_tokens_id_seq OWNED BY public.device_tokens.id;


--
-- Name: email_rate_limits; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.email_rate_limits (
    email character varying(255) NOT NULL,
    request_count integer DEFAULT 0,
    window_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_rate_limits OWNER TO avnadmin;

--
-- Name: employee_locations; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_locations (
    id integer NOT NULL,
    user_id integer,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    accuracy numeric(10,2),
    is_moving boolean DEFAULT false,
    battery_level integer,
    shift_id integer,
    is_outdoor boolean DEFAULT false,
    geofence_status character varying(20),
    movement_type character varying(20),
    location_accuracy integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_tracking_active boolean DEFAULT false
);


ALTER TABLE public.employee_locations OWNER TO avnadmin;

--
-- Name: employee_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_locations_id_seq OWNER TO avnadmin;

--
-- Name: employee_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_locations_id_seq OWNED BY public.employee_locations.id;


--
-- Name: employee_schedule; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_schedule (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    description text,
    date date NOT NULL,
    "time" time without time zone NOT NULL,
    location character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'pending'::character varying
);


ALTER TABLE public.employee_schedule OWNER TO avnadmin;

--
-- Name: employee_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_schedule_id_seq OWNER TO avnadmin;

--
-- Name: employee_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_schedule_id_seq OWNED BY public.employee_schedule.id;


--
-- Name: employee_shifts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_shifts (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration interval,
    status character varying(20) DEFAULT 'active'::character varying,
    total_kilometers numeric DEFAULT 0,
    total_expenses numeric DEFAULT 0,
    location_start point,
    location_end point,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_history public.geography(LineString,4326),
    total_distance_km numeric(10,2) DEFAULT 0,
    travel_time_minutes integer DEFAULT 0,
    last_location_update timestamp without time zone,
    is_tracking_active boolean DEFAULT false,
    ended_automatically boolean DEFAULT false NOT NULL,
    face_verification_start boolean DEFAULT false,
    face_verification_end boolean DEFAULT false,
    face_verification_start_confidence numeric(5,4),
    face_verification_end_confidence numeric(5,4),
    face_verification_start_liveness boolean DEFAULT false,
    face_verification_end_liveness boolean DEFAULT false,
    location_verification_start boolean DEFAULT false,
    location_verification_end boolean DEFAULT false,
    verification_override_reason text,
    verification_override_by integer,
    verification_override_at timestamp with time zone,
    combined_verification_score numeric(5,4),
    verification_method character varying(20),
    CONSTRAINT employee_shifts_verification_method_check CHECK (((verification_method)::text = ANY ((ARRAY['face_only'::character varying, 'location_only'::character varying, 'combined'::character varying, 'override'::character varying])::text[])))
);


ALTER TABLE public.employee_shifts OWNER TO avnadmin;

--
-- Name: employee_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_shifts_id_seq OWNER TO avnadmin;

--
-- Name: employee_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_shifts_id_seq OWNED BY public.employee_shifts.id;


--
-- Name: employee_tasks; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_tasks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    assigned_to integer,
    assigned_by integer,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_status_update timestamp without time zone,
    status_history jsonb DEFAULT '[]'::jsonb,
    is_reassigned boolean DEFAULT false,
    customer_name character varying(255),
    customer_contact character varying(255),
    customer_notes text,
    send_customer_updates boolean DEFAULT false,
    attachments jsonb DEFAULT '[]'::jsonb,
    customer_contact_type character varying(20) DEFAULT 'email'::character varying,
    CONSTRAINT employee_tasks_customer_contact_type_check CHECK (((customer_contact_type)::text = ANY ((ARRAY['email'::character varying, 'phone'::character varying])::text[]))),
    CONSTRAINT employee_tasks_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.employee_tasks OWNER TO avnadmin;

--
-- Name: COLUMN employee_tasks.customer_name; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.employee_tasks.customer_name IS 'Name of the customer associated with the task';


--
-- Name: COLUMN employee_tasks.customer_contact; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.employee_tasks.customer_contact IS 'Email or phone number of the customer';


--
-- Name: COLUMN employee_tasks.customer_notes; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.employee_tasks.customer_notes IS 'Additional notes about the customer or task requirements';


--
-- Name: COLUMN employee_tasks.send_customer_updates; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.employee_tasks.send_customer_updates IS 'Whether to send status updates to the customer';


--
-- Name: COLUMN employee_tasks.attachments; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.employee_tasks.attachments IS 'JSON array of attachment metadata (file names, types, sizes)';


--
-- Name: COLUMN employee_tasks.customer_contact_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.employee_tasks.customer_contact_type IS 'Type of customer contact: email or phone';


--
-- Name: employee_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_tasks_id_seq OWNER TO avnadmin;

--
-- Name: employee_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_tasks_id_seq OWNED BY public.employee_tasks.id;


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.error_logs (
    id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    service character varying(100) NOT NULL,
    error_type character varying(100) NOT NULL,
    message text NOT NULL,
    user_id integer,
    metadata jsonb,
    stack_trace text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.error_logs OWNER TO avnadmin;

--
-- Name: error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.error_logs_id_seq OWNER TO avnadmin;

--
-- Name: error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;


--
-- Name: expense_documents; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.expense_documents (
    id integer NOT NULL,
    expense_id integer,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    file_data bytea NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.expense_documents OWNER TO avnadmin;

--
-- Name: expense_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.expense_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expense_documents_id_seq OWNER TO avnadmin;

--
-- Name: expense_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.expense_documents_id_seq OWNED BY public.expense_documents.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.expenses (
    id integer,
    user_id integer,
    employee_name character varying(100),
    employee_number character varying(50),
    department character varying(100),
    designation character varying(100),
    location character varying(100),
    date timestamp without time zone,
    vehicle_type character varying(50),
    vehicle_number character varying(50),
    total_kilometers numeric,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    route_taken text,
    lodging_expenses numeric,
    daily_allowance numeric,
    diesel numeric,
    toll_charges numeric,
    other_expenses numeric,
    advance_taken numeric,
    total_amount numeric,
    amount_payable numeric,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    comments text,
    group_admin_id integer,
    rejection_reason text,
    category character varying(50),
    shift_id integer
);


ALTER TABLE public.expenses OWNER TO avnadmin;

--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expenses_id_seq OWNER TO avnadmin;

--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: face_verification_logs; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.face_verification_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    shift_id integer,
    verification_type character varying(20) NOT NULL,
    success boolean NOT NULL,
    confidence_score numeric(5,4),
    liveness_detected boolean DEFAULT false,
    liveness_score numeric(5,4),
    failure_reason text,
    attempt_number integer DEFAULT 1,
    device_fingerprint text,
    ip_address inet,
    user_agent text,
    location_data jsonb,
    verification_duration_ms integer,
    face_quality_score numeric(5,4),
    lighting_conditions character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT face_verification_logs_lighting_conditions_check CHECK (((lighting_conditions)::text = ANY ((ARRAY['poor'::character varying, 'fair'::character varying, 'good'::character varying, 'excellent'::character varying])::text[]))),
    CONSTRAINT face_verification_logs_verification_type_check CHECK (((verification_type)::text = ANY ((ARRAY['start'::character varying, 'end'::character varying, 'registration'::character varying, 'update'::character varying, 'test'::character varying])::text[])))
);


ALTER TABLE public.face_verification_logs OWNER TO avnadmin;

--
-- Name: TABLE face_verification_logs; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.face_verification_logs IS 'Comprehensive audit trail for all face verification attempts and outcomes';


--
-- Name: COLUMN face_verification_logs.confidence_score; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.face_verification_logs.confidence_score IS 'Face verification confidence score (0.0-1.0), higher is more confident';


--
-- Name: COLUMN face_verification_logs.liveness_score; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.face_verification_logs.liveness_score IS 'Liveness detection confidence (0.0-1.0), higher indicates real person';


--
-- Name: face_verification_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.face_verification_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.face_verification_logs_id_seq OWNER TO avnadmin;

--
-- Name: face_verification_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.face_verification_logs_id_seq OWNED BY public.face_verification_logs.id;


--
-- Name: face_verification_profiles; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.face_verification_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    face_encoding_hash text NOT NULL,
    encrypted_face_data text NOT NULL,
    encryption_key_hash text NOT NULL,
    registration_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    verification_count integer DEFAULT 0,
    last_verification_at timestamp with time zone,
    registration_device_info jsonb DEFAULT '{}'::jsonb,
    quality_score numeric(5,4),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.face_verification_profiles OWNER TO avnadmin;

--
-- Name: TABLE face_verification_profiles; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.face_verification_profiles IS 'Stores encrypted face encodings and profile metadata for biometric authentication';


--
-- Name: COLUMN face_verification_profiles.face_encoding_hash; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.face_verification_profiles.face_encoding_hash IS 'SHA-256 hash for quick face encoding comparison without decryption';


--
-- Name: COLUMN face_verification_profiles.encrypted_face_data; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.face_verification_profiles.encrypted_face_data IS 'AES-256 encrypted face encoding data using device-specific keys';


--
-- Name: face_verification_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.face_verification_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.face_verification_profiles_id_seq OWNER TO avnadmin;

--
-- Name: face_verification_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.face_verification_profiles_id_seq OWNED BY public.face_verification_profiles.id;


--
-- Name: geofence_events; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.geofence_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    geofence_id integer NOT NULL,
    shift_id integer NOT NULL,
    event_type character varying(10) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT geofence_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('entry'::character varying)::text, ('exit'::character varying)::text])))
);


ALTER TABLE public.geofence_events OWNER TO avnadmin;

--
-- Name: geofence_events_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.geofence_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.geofence_events_id_seq OWNER TO avnadmin;

--
-- Name: geofence_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.geofence_events_id_seq OWNED BY public.geofence_events.id;


--
-- Name: group_admin_shifts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.group_admin_shifts (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration interval,
    status character varying(20) DEFAULT 'active'::character varying,
    total_kilometers numeric DEFAULT 0,
    total_expenses numeric DEFAULT 0,
    location_start point,
    location_end point,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_automatically boolean DEFAULT false
);


ALTER TABLE public.group_admin_shifts OWNER TO avnadmin;

--
-- Name: group_admin_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.group_admin_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_admin_shifts_id_seq OWNER TO avnadmin;

--
-- Name: group_admin_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.group_admin_shifts_id_seq OWNED BY public.group_admin_shifts.id;


--
-- Name: leave_balance_audit_log; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_balance_audit_log (
    id integer NOT NULL,
    user_id integer,
    leave_type_id integer,
    year integer,
    old_total_days integer,
    new_total_days integer,
    old_carry_forward_days integer,
    new_carry_forward_days integer,
    modified_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_balance_audit_log OWNER TO avnadmin;

--
-- Name: leave_balance_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_balance_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_balance_audit_log_id_seq OWNER TO avnadmin;

--
-- Name: leave_balance_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_balance_audit_log_id_seq OWNED BY public.leave_balance_audit_log.id;


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_balances (
    id integer NOT NULL,
    user_id integer,
    leave_type_id integer,
    total_days integer NOT NULL,
    used_days integer DEFAULT 0,
    pending_days integer DEFAULT 0,
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    carry_forward_days integer DEFAULT 0
);


ALTER TABLE public.leave_balances OWNER TO avnadmin;

--
-- Name: leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_balances_id_seq OWNER TO avnadmin;

--
-- Name: leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;


--
-- Name: leave_documents; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_documents (
    id integer NOT NULL,
    request_id integer,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_data text NOT NULL,
    upload_method character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leave_documents_upload_method_check CHECK (((upload_method)::text = ANY (ARRAY[('camera'::character varying)::text, ('file'::character varying)::text])))
);


ALTER TABLE public.leave_documents OWNER TO avnadmin;

--
-- Name: leave_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_documents_id_seq OWNER TO avnadmin;

--
-- Name: leave_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_documents_id_seq OWNED BY public.leave_documents.id;


--
-- Name: leave_escalations; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_escalations (
    id integer NOT NULL,
    request_id integer NOT NULL,
    escalated_by integer NOT NULL,
    escalated_to integer NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    CONSTRAINT leave_escalations_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('resolved'::character varying)::text])))
);


ALTER TABLE public.leave_escalations OWNER TO avnadmin;

--
-- Name: leave_escalations_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_escalations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_escalations_id_seq OWNER TO avnadmin;

--
-- Name: leave_escalations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_escalations_id_seq OWNED BY public.leave_escalations.id;


--
-- Name: leave_policies; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_policies (
    id integer NOT NULL,
    leave_type_id integer,
    default_days integer NOT NULL,
    carry_forward_days integer DEFAULT 0,
    min_service_days integer DEFAULT 0,
    requires_approval boolean DEFAULT true,
    notice_period_days integer DEFAULT 0,
    max_consecutive_days integer,
    gender_specific character varying(10),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_policies OWNER TO avnadmin;

--
-- Name: leave_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_policies_id_seq OWNER TO avnadmin;

--
-- Name: leave_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_policies_id_seq OWNED BY public.leave_policies.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer,
    leave_type_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    rejection_reason text,
    contact_number character varying(20) NOT NULL,
    requires_documentation boolean DEFAULT false,
    approver_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    days_requested integer NOT NULL,
    has_documentation boolean DEFAULT false,
    group_admin_id integer,
    workflow_id integer,
    current_level_id integer,
    final_approver_id integer,
    approval_status character varying(20) DEFAULT 'pending'::character varying,
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('escalated'::character varying)::text, ('cancelled'::character varying)::text])))
);


ALTER TABLE public.leave_requests OWNER TO avnadmin;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_requests_id_seq OWNER TO avnadmin;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    requires_documentation boolean DEFAULT false,
    max_days integer,
    is_paid boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer NOT NULL
);


ALTER TABLE public.leave_types OWNER TO avnadmin;

--
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_types_id_seq OWNER TO avnadmin;

--
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- Name: management_shifts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.management_shifts (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration interval,
    status character varying(20) DEFAULT 'active'::character varying,
    total_kilometers numeric DEFAULT 0,
    total_expenses numeric DEFAULT 0,
    location_start point,
    location_end point,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_automatically boolean DEFAULT false
);


ALTER TABLE public.management_shifts OWNER TO avnadmin;

--
-- Name: management_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.management_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.management_shifts_id_seq OWNER TO avnadmin;

--
-- Name: management_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.management_shifts_id_seq OWNED BY public.management_shifts.id;


--
-- Name: manual_leave_adjustments; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.manual_leave_adjustments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    year integer NOT NULL,
    adjusted_by integer NOT NULL,
    before_value integer NOT NULL,
    after_value integer NOT NULL,
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manual_leave_adjustments OWNER TO avnadmin;

--
-- Name: manual_leave_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.manual_leave_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.manual_leave_adjustments_id_seq OWNER TO avnadmin;

--
-- Name: manual_leave_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.manual_leave_adjustments_id_seq OWNED BY public.manual_leave_adjustments.id;


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.notification_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    role character varying(50) NOT NULL,
    priority character varying(20) DEFAULT 'default'::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    variables text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_templates OWNER TO avnadmin;

--
-- Name: notification_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_templates_id_seq OWNER TO avnadmin;

--
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO avnadmin;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO avnadmin;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: offline_verification_sync; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.offline_verification_sync (
    id integer NOT NULL,
    offline_id character varying(255) NOT NULL,
    user_id integer NOT NULL,
    shift_action character varying(10) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    face_verification_data jsonb DEFAULT '{}'::jsonb,
    location_verification_data jsonb DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sync_attempts integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offline_verification_sync_shift_action_check CHECK (((shift_action)::text = ANY ((ARRAY['start'::character varying, 'end'::character varying])::text[])))
);


ALTER TABLE public.offline_verification_sync OWNER TO avnadmin;

--
-- Name: TABLE offline_verification_sync; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.offline_verification_sync IS 'Sync table for offline verification data when connectivity is restored';


--
-- Name: offline_verification_sync_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.offline_verification_sync_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.offline_verification_sync_id_seq OWNER TO avnadmin;

--
-- Name: offline_verification_sync_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.offline_verification_sync_id_seq OWNED BY public.offline_verification_sync.id;


--
-- Name: otp_rate_limits; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.otp_rate_limits (
    phone_number character varying(20) NOT NULL,
    request_count integer DEFAULT 0,
    window_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(255)
);


ALTER TABLE public.otp_rate_limits OWNER TO avnadmin;

--
-- Name: otp_records; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.otp_records (
    id character varying(36) NOT NULL,
    phone_number character varying(20),
    otp_hash character varying(64) NOT NULL,
    purpose character varying(50) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    is_used boolean DEFAULT false,
    device_fingerprint text,
    ip_address inet,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verified_at timestamp with time zone,
    invalidated_at timestamp with time zone,
    email character varying(255),
    CONSTRAINT check_contact_method CHECK ((((phone_number IS NOT NULL) AND (email IS NULL)) OR ((phone_number IS NULL) AND (email IS NOT NULL)))),
    CONSTRAINT otp_records_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['shift_start'::character varying, 'shift_end'::character varying, 'face_verification'::character varying, 'account_verification'::character varying, 'face-settings-access'::character varying, 'profile-update'::character varying, 'security-verification'::character varying, 'password-reset'::character varying, 'manager_override'::character varying])::text[])))
);


ALTER TABLE public.otp_records OWNER TO avnadmin;

--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.otp_verifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    phone_number character varying(20) NOT NULL,
    otp_code_hash text NOT NULL,
    purpose character varying(50) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified boolean DEFAULT false,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    ip_address inet,
    device_fingerprint text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verified_at timestamp with time zone,
    invalidated_at timestamp with time zone,
    CONSTRAINT otp_verifications_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['face_settings'::character varying, 'face_registration'::character varying, 'face_deletion'::character varying, 'profile_update'::character varying])::text[])))
);


ALTER TABLE public.otp_verifications OWNER TO avnadmin;

--
-- Name: TABLE otp_verifications; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.otp_verifications IS 'Secure OTP system for accessing sensitive face configuration settings';


--
-- Name: COLUMN otp_verifications.otp_code_hash; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.otp_verifications.otp_code_hash IS 'Bcrypt hashed OTP code for secure storage and verification';


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.otp_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_verifications_id_seq OWNER TO avnadmin;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.otp_verifications_id_seq OWNED BY public.otp_verifications.id;


--
-- Name: push_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.push_notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    type character varying(50) NOT NULL,
    sent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp with time zone,
    action_url character varying(255),
    priority character varying(20) DEFAULT 'default'::character varying,
    category character varying(50),
    expires_at timestamp with time zone,
    batch_id character varying(255),
    template_id integer,
    CONSTRAINT push_notifications_priority_check CHECK (((priority)::text = ANY (ARRAY[('high'::character varying)::text, ('default'::character varying)::text, ('low'::character varying)::text])))
);


ALTER TABLE public.push_notifications OWNER TO avnadmin;

--
-- Name: push_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.push_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_notifications_id_seq OWNER TO avnadmin;

--
-- Name: push_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.push_notifications_id_seq OWNED BY public.push_notifications.id;


--
-- Name: push_receipts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.push_receipts (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    receipt_id character varying(36) NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    error_details jsonb
);


ALTER TABLE public.push_receipts OWNER TO avnadmin;

--
-- Name: push_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.push_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_receipts_id_seq OWNER TO avnadmin;

--
-- Name: push_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.push_receipts_id_seq OWNED BY public.push_receipts.id;


--
-- Name: regularization_approval_history; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.regularization_approval_history (
    id integer NOT NULL,
    request_id integer NOT NULL,
    approver_id integer NOT NULL,
    approver_role character varying(20) NOT NULL,
    action character varying(20) NOT NULL,
    comments text,
    action_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address inet,
    user_agent text,
    CONSTRAINT chk_action_valid CHECK (((action)::text = ANY ((ARRAY['submitted'::character varying, 'group_admin_approved'::character varying, 'group_admin_rejected'::character varying, 'management_approved'::character varying, 'management_rejected'::character varying, 'final_approved'::character varying, 'final_rejected'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.regularization_approval_history OWNER TO avnadmin;

--
-- Name: TABLE regularization_approval_history; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.regularization_approval_history IS 'Audit trail for all approval actions on regularization requests';


--
-- Name: COLUMN regularization_approval_history.action; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.regularization_approval_history.action IS 'Action taken by the approver';


--
-- Name: regularization_approval_history_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.regularization_approval_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.regularization_approval_history_id_seq OWNER TO avnadmin;

--
-- Name: regularization_approval_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.regularization_approval_history_id_seq OWNED BY public.regularization_approval_history.id;


--
-- Name: regularization_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.regularization_notifications (
    id integer NOT NULL,
    request_id integer NOT NULL,
    recipient_id integer NOT NULL,
    notification_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_data jsonb,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp with time zone,
    delivery_status character varying(20) DEFAULT 'sent'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.regularization_notifications OWNER TO avnadmin;

--
-- Name: TABLE regularization_notifications; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.regularization_notifications IS 'Notification tracking for regularization request status updates';


--
-- Name: COLUMN regularization_notifications.notification_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.regularization_notifications.notification_type IS 'Type of notification sent';


--
-- Name: regularization_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.regularization_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.regularization_notifications_id_seq OWNER TO avnadmin;

--
-- Name: regularization_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.regularization_notifications_id_seq OWNED BY public.regularization_notifications.id;


--
-- Name: request_approvals; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.request_approvals (
    id integer NOT NULL,
    request_id integer NOT NULL,
    workflow_id integer NOT NULL,
    level_id integer NOT NULL,
    approver_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    comments text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.request_approvals OWNER TO avnadmin;

--
-- Name: request_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.request_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_approvals_id_seq OWNER TO avnadmin;

--
-- Name: request_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.request_approvals_id_seq OWNED BY public.request_approvals.id;


--
-- Name: scheduled_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.scheduled_notifications (
    id integer NOT NULL,
    template_id integer,
    variables jsonb DEFAULT '{}'::jsonb,
    target_role character varying(50),
    target_user_id integer,
    target_group_admin_id integer,
    scheduled_for timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp with time zone,
    error text,
    CONSTRAINT chk_target_specification CHECK ((((target_role IS NOT NULL) AND (target_user_id IS NULL) AND (target_group_admin_id IS NULL)) OR ((target_role IS NULL) AND (target_user_id IS NOT NULL) AND (target_group_admin_id IS NULL)) OR ((target_role IS NULL) AND (target_user_id IS NULL) AND (target_group_admin_id IS NOT NULL))))
);


ALTER TABLE public.scheduled_notifications OWNER TO avnadmin;

--
-- Name: scheduled_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.scheduled_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduled_notifications_id_seq OWNER TO avnadmin;

--
-- Name: scheduled_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.scheduled_notifications_id_seq OWNED BY public.scheduled_notifications.id;


--
-- Name: shift_timer_settings; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.shift_timer_settings (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    user_id integer NOT NULL,
    timer_duration_hours numeric(5,2) NOT NULL,
    end_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed boolean DEFAULT false,
    notification_sent boolean DEFAULT false,
    role_type character varying(20) DEFAULT 'employee'::character varying,
    shift_table_name character varying(50) DEFAULT 'employee_shifts'::character varying
);


ALTER TABLE public.shift_timer_settings OWNER TO avnadmin;

--
-- Name: TABLE shift_timer_settings; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.shift_timer_settings IS 'Updated timezone handling - 2025-01-24';


--
-- Name: COLUMN shift_timer_settings.role_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.shift_timer_settings.role_type IS 'User role type (employee, group-admin, management) to determine which shifts table to use';


--
-- Name: COLUMN shift_timer_settings.shift_table_name; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.shift_timer_settings.shift_table_name IS 'Name of the table where the shift is stored (employee_shifts, group_admin_shifts, management_shifts)';


--
-- Name: shift_timer_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.shift_timer_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_timer_settings_id_seq OWNER TO avnadmin;

--
-- Name: shift_timer_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.shift_timer_settings_id_seq OWNED BY public.shift_timer_settings.id;


--
-- Name: sms_delivery_log; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.sms_delivery_log (
    id integer NOT NULL,
    otp_record_id character varying(36),
    phone_number character varying(20),
    message_content text NOT NULL,
    provider_name character varying(50) NOT NULL,
    provider_message_id character varying(255),
    delivery_status character varying(20) DEFAULT 'pending'::character varying,
    cost_cents integer DEFAULT 0,
    error_message text,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    delivered_at timestamp with time zone,
    failed_at timestamp with time zone,
    email character varying(255),
    delivery_method character varying(10) DEFAULT 'sms'::character varying,
    CONSTRAINT check_delivery_log_contact_method CHECK ((((phone_number IS NOT NULL) AND (email IS NULL)) OR ((phone_number IS NULL) AND (email IS NOT NULL)))),
    CONSTRAINT sms_delivery_log_delivery_method_check CHECK (((delivery_method)::text = ANY ((ARRAY['sms'::character varying, 'email'::character varying])::text[]))),
    CONSTRAINT sms_delivery_log_delivery_status_check CHECK (((delivery_status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'failed'::character varying, 'unknown'::character varying])::text[])))
);


ALTER TABLE public.sms_delivery_log OWNER TO avnadmin;

--
-- Name: sms_delivery_log_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.sms_delivery_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_delivery_log_id_seq OWNER TO avnadmin;

--
-- Name: sms_delivery_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.sms_delivery_log_id_seq OWNED BY public.sms_delivery_log.id;


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.support_messages (
    id integer NOT NULL,
    user_id integer,
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    user_email character varying(100) NOT NULL,
    user_name character varying(100) NOT NULL,
    user_role character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone
);


ALTER TABLE public.support_messages OWNER TO avnadmin;

--
-- Name: support_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_messages_id_seq OWNER TO avnadmin;

--
-- Name: support_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;


--
-- Name: task_activity_history; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.task_activity_history (
    id integer NOT NULL,
    task_id integer NOT NULL,
    user_id integer,
    activity_type character varying(50) NOT NULL,
    activity_description text NOT NULL,
    old_value text,
    new_value text,
    change_details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address inet,
    user_agent text,
    CONSTRAINT task_activity_history_activity_type_check CHECK (((activity_type)::text = ANY ((ARRAY['task_created'::character varying, 'task_assigned'::character varying, 'task_reassigned'::character varying, 'status_changed'::character varying, 'priority_changed'::character varying, 'due_date_changed'::character varying, 'comment_added'::character varying, 'attachment_added'::character varying, 'attachment_removed'::character varying, 'customer_updated'::character varying, 'task_completed'::character varying, 'task_cancelled'::character varying])::text[])))
);


ALTER TABLE public.task_activity_history OWNER TO avnadmin;

--
-- Name: TABLE task_activity_history; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.task_activity_history IS 'Tracks all activities and changes made to tasks';


--
-- Name: COLUMN task_activity_history.activity_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_activity_history.activity_type IS 'Type of activity performed on the task';


--
-- Name: COLUMN task_activity_history.change_details; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_activity_history.change_details IS 'Additional details about the change in JSON format';


--
-- Name: task_activity_history_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.task_activity_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_activity_history_id_seq OWNER TO avnadmin;

--
-- Name: task_activity_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.task_activity_history_id_seq OWNED BY public.task_activity_history.id;


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.task_attachments (
    id integer NOT NULL,
    task_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    file_data bytea NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_attachments OWNER TO avnadmin;

--
-- Name: TABLE task_attachments; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.task_attachments IS 'Stores file attachments for tasks in base64 format';


--
-- Name: COLUMN task_attachments.file_data; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_attachments.file_data IS 'Base64 encoded file data';


--
-- Name: task_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.task_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_attachments_id_seq OWNER TO avnadmin;

--
-- Name: task_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.task_attachments_id_seq OWNED BY public.task_attachments.id;


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.task_comments (
    id integer NOT NULL,
    task_id integer NOT NULL,
    user_id integer NOT NULL,
    comment text NOT NULL,
    comment_type character varying(50) DEFAULT 'general'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by integer,
    CONSTRAINT task_comments_comment_type_check CHECK (((comment_type)::text = ANY ((ARRAY['general'::character varying, 'status_update'::character varying, 'priority_change'::character varying, 'assignment'::character varying, 'note'::character varying])::text[])))
);


ALTER TABLE public.task_comments OWNER TO avnadmin;

--
-- Name: TABLE task_comments; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.task_comments IS 'Stores comments and notes between group admins and employees for tasks';


--
-- Name: COLUMN task_comments.comment_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_comments.comment_type IS 'Type of comment: general, status_update, priority_change, assignment, note';


--
-- Name: COLUMN task_comments.is_deleted; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_comments.is_deleted IS 'Soft delete flag for comments';


--
-- Name: task_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.task_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_comments_id_seq OWNER TO avnadmin;

--
-- Name: task_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.task_comments_id_seq OWNED BY public.task_comments.id;


--
-- Name: task_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.task_notifications (
    id integer NOT NULL,
    task_id integer NOT NULL,
    recipient_id integer NOT NULL,
    notification_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_data jsonb DEFAULT '{}'::jsonb,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp with time zone,
    delivery_status character varying(20) DEFAULT 'sent'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT task_notifications_delivery_status_check CHECK (((delivery_status)::text = ANY ((ARRAY['sent'::character varying, 'delivered'::character varying, 'failed'::character varying, 'read'::character varying])::text[]))),
    CONSTRAINT task_notifications_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['task_assigned'::character varying, 'task_reassigned'::character varying, 'status_update'::character varying, 'comment_added'::character varying, 'due_date_reminder'::character varying, 'overdue_task'::character varying, 'priority_changed'::character varying, 'attachment_added'::character varying])::text[])))
);


ALTER TABLE public.task_notifications OWNER TO avnadmin;

--
-- Name: TABLE task_notifications; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.task_notifications IS 'Tracks push notifications sent for task-related events';


--
-- Name: COLUMN task_notifications.notification_type; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_notifications.notification_type IS 'Type of notification sent';


--
-- Name: COLUMN task_notifications.delivery_status; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.task_notifications.delivery_status IS 'Status of notification delivery';


--
-- Name: task_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.task_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_notifications_id_seq OWNER TO avnadmin;

--
-- Name: task_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.task_notifications_id_seq OWNED BY public.task_notifications.id;


--
-- Name: tracking_analytics; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.tracking_analytics (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    total_distance numeric(10,2) DEFAULT 0,
    total_distance_km numeric(10,2) DEFAULT 0,
    total_travel_time_minutes integer DEFAULT 0,
    outdoor_time integer DEFAULT 0,
    indoor_time integer DEFAULT 0,
    indoor_time_minutes integer DEFAULT 0,
    outdoor_time_minutes integer DEFAULT 0,
    last_update timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tracking_analytics OWNER TO avnadmin;

--
-- Name: tracking_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.tracking_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tracking_analytics_id_seq OWNER TO avnadmin;

--
-- Name: tracking_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.tracking_analytics_id_seq OWNED BY public.tracking_analytics.id;


--
-- Name: user_tracking_permissions; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.user_tracking_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    can_override_geofence boolean DEFAULT false NOT NULL,
    tracking_precision character varying(20) DEFAULT 'high'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_required_for_shift boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_tracking_precision CHECK (((tracking_precision)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text])))
);


ALTER TABLE public.user_tracking_permissions OWNER TO avnadmin;

--
-- Name: COLUMN user_tracking_permissions.location_required_for_shift; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.user_tracking_permissions.location_required_for_shift IS 'Whether location access is required for shift tracking';


--
-- Name: user_tracking_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.user_tracking_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tracking_permissions_id_seq OWNER TO avnadmin;

--
-- Name: user_tracking_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.user_tracking_permissions_id_seq OWNED BY public.user_tracking_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20),
    password character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    last_login timestamp without time zone,
    failed_login_attempts integer DEFAULT 0,
    password_reset_required boolean DEFAULT false,
    company_id integer,
    can_submit_expenses_anytime boolean DEFAULT false,
    shift_status character varying(20) DEFAULT 'inactive'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    employee_number character varying(50),
    department character varying(100),
    designation character varying(100),
    group_admin_id integer,
    profile_image bytea,
    token_version integer DEFAULT 0,
    gender character varying(10),
    management_id integer,
    face_registered boolean DEFAULT false,
    face_enabled boolean DEFAULT true,
    face_registration_required boolean DEFAULT true,
    face_registration_completed_at timestamp with time zone,
    last_face_verification timestamp with time zone,
    face_verification_failures integer DEFAULT 0,
    face_locked_until timestamp with time zone,
    face_verification_success_count integer DEFAULT 0,
    biometric_consent_given boolean DEFAULT false,
    biometric_consent_date timestamp with time zone,
    face_data_retention_until timestamp with time zone,
    face_quality_threshold numeric(3,2) DEFAULT 0.70,
    mfa_enabled boolean DEFAULT false,
    mfa_otp character varying(64),
    mfa_otp_expires timestamp without time zone,
    mfa_otp_attempts integer DEFAULT 0,
    mfa_last_used timestamp without time zone,
    mfa_setup_date timestamp without time zone,
    CONSTRAINT users_face_quality_threshold_check CHECK (((face_quality_threshold >= (0)::numeric) AND (face_quality_threshold <= (1)::numeric))),
    CONSTRAINT users_gender_check CHECK (((gender)::text = ANY (ARRAY[('male'::character varying)::text, ('female'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('employee'::character varying)::text, ('group-admin'::character varying)::text, ('management'::character varying)::text, ('super-admin'::character varying)::text])))
);


ALTER TABLE public.users OWNER TO avnadmin;

--
-- Name: COLUMN users.mfa_enabled; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.users.mfa_enabled IS 'Whether MFA is enabled for this user';


--
-- Name: COLUMN users.mfa_otp; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.users.mfa_otp IS 'Current MFA OTP code (SHA-256 hashed)';


--
-- Name: COLUMN users.mfa_otp_expires; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.users.mfa_otp_expires IS 'When the current MFA OTP expires';


--
-- Name: COLUMN users.mfa_otp_attempts; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.users.mfa_otp_attempts IS 'Number of failed MFA attempts';


--
-- Name: COLUMN users.mfa_last_used; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.users.mfa_last_used IS 'Last time MFA was successfully used';


--
-- Name: COLUMN users.mfa_setup_date; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.users.mfa_setup_date IS 'When MFA was first enabled';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO avnadmin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: verification_audit_events; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.verification_audit_events (
    id integer NOT NULL,
    audit_log_id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    event_type character varying(50) NOT NULL,
    step_type character varying(20),
    success boolean,
    error_message text,
    latency integer,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT verification_audit_events_step_type_check CHECK (((step_type)::text = ANY ((ARRAY['location'::character varying, 'face'::character varying])::text[])))
);


ALTER TABLE public.verification_audit_events OWNER TO avnadmin;

--
-- Name: TABLE verification_audit_events; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.verification_audit_events IS 'Detailed event log for verification flow debugging and monitoring';


--
-- Name: verification_audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.verification_audit_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.verification_audit_events_id_seq OWNER TO avnadmin;

--
-- Name: verification_audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.verification_audit_events_id_seq OWNED BY public.verification_audit_events.id;


--
-- Name: verification_audit_logs; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.verification_audit_logs (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    user_id integer NOT NULL,
    shift_action character varying(10) NOT NULL,
    status character varying(20) NOT NULL,
    confidence_score numeric(5,4) DEFAULT 0,
    total_latency integer,
    fallback_mode boolean DEFAULT false,
    override_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT verification_audit_logs_shift_action_check CHECK (((shift_action)::text = ANY ((ARRAY['start'::character varying, 'end'::character varying])::text[]))),
    CONSTRAINT verification_audit_logs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'failed'::character varying, 'overridden'::character varying])::text[])))
);


ALTER TABLE public.verification_audit_logs OWNER TO avnadmin;

--
-- Name: TABLE verification_audit_logs; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.verification_audit_logs IS 'Main audit log for verification flow sessions with performance metrics';


--
-- Name: verification_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.verification_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.verification_audit_logs_id_seq OWNER TO avnadmin;

--
-- Name: verification_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.verification_audit_logs_id_seq OWNED BY public.verification_audit_logs.id;


--
-- Name: verification_audit_steps; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.verification_audit_steps (
    id integer NOT NULL,
    audit_log_id integer NOT NULL,
    step_type character varying(20) NOT NULL,
    completed boolean DEFAULT false,
    retry_count integer DEFAULT 0,
    latency integer,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT verification_audit_steps_step_type_check CHECK (((step_type)::text = ANY ((ARRAY['location'::character varying, 'face'::character varying])::text[])))
);


ALTER TABLE public.verification_audit_steps OWNER TO avnadmin;

--
-- Name: TABLE verification_audit_steps; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON TABLE public.verification_audit_steps IS 'Individual verification steps within a flow session';


--
-- Name: verification_audit_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.verification_audit_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.verification_audit_steps_id_seq OWNER TO avnadmin;

--
-- Name: verification_audit_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.verification_audit_steps_id_seq OWNED BY public.verification_audit_steps.id;


--
-- Name: workflow_levels; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.workflow_levels (
    id integer NOT NULL,
    workflow_id integer NOT NULL,
    level_id integer NOT NULL,
    is_required boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workflow_levels OWNER TO avnadmin;

--
-- Name: workflow_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.workflow_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_levels_id_seq OWNER TO avnadmin;

--
-- Name: workflow_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.workflow_levels_id_seq OWNED BY public.workflow_levels.id;


--
-- Name: approval_levels id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_levels ALTER COLUMN id SET DEFAULT nextval('public.approval_levels_id_seq'::regclass);


--
-- Name: approval_workflows id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_workflows ALTER COLUMN id SET DEFAULT nextval('public.approval_workflows_id_seq'::regclass);


--
-- Name: attendance_regularization_requests id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests ALTER COLUMN id SET DEFAULT nextval('public.attendance_regularization_requests_id_seq'::regclass);


--
-- Name: biometric_audit_logs id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.biometric_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.biometric_audit_logs_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: company_default_leave_balances id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_default_leave_balances ALTER COLUMN id SET DEFAULT nextval('public.company_default_leave_balances_id_seq'::regclass);


--
-- Name: company_geofences id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences ALTER COLUMN id SET DEFAULT nextval('public.company_geofences_id_seq'::regclass);


--
-- Name: company_holidays id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_holidays ALTER COLUMN id SET DEFAULT nextval('public.company_holidays_id_seq'::regclass);


--
-- Name: company_tracking_settings id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_tracking_settings ALTER COLUMN id SET DEFAULT nextval('public.company_tracking_settings_id_seq'::regclass);


--
-- Name: customer_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.customer_notifications ALTER COLUMN id SET DEFAULT nextval('public.customer_notifications_id_seq'::regclass);


--
-- Name: device_fingerprints id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_fingerprints ALTER COLUMN id SET DEFAULT nextval('public.device_fingerprints_id_seq'::regclass);


--
-- Name: device_tokens id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens ALTER COLUMN id SET DEFAULT nextval('public.device_tokens_id_seq'::regclass);


--
-- Name: employee_locations id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations ALTER COLUMN id SET DEFAULT nextval('public.employee_locations_id_seq'::regclass);


--
-- Name: employee_schedule id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_schedule ALTER COLUMN id SET DEFAULT nextval('public.employee_schedule_id_seq'::regclass);


--
-- Name: employee_shifts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts ALTER COLUMN id SET DEFAULT nextval('public.employee_shifts_id_seq'::regclass);


--
-- Name: employee_tasks id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks ALTER COLUMN id SET DEFAULT nextval('public.employee_tasks_id_seq'::regclass);


--
-- Name: error_logs id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);


--
-- Name: expense_documents id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expense_documents ALTER COLUMN id SET DEFAULT nextval('public.expense_documents_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: face_verification_logs id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_logs ALTER COLUMN id SET DEFAULT nextval('public.face_verification_logs_id_seq'::regclass);


--
-- Name: face_verification_profiles id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_profiles ALTER COLUMN id SET DEFAULT nextval('public.face_verification_profiles_id_seq'::regclass);


--
-- Name: geofence_events id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events ALTER COLUMN id SET DEFAULT nextval('public.geofence_events_id_seq'::regclass);


--
-- Name: group_admin_shifts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.group_admin_shifts ALTER COLUMN id SET DEFAULT nextval('public.group_admin_shifts_id_seq'::regclass);


--
-- Name: leave_balance_audit_log id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balance_audit_log ALTER COLUMN id SET DEFAULT nextval('public.leave_balance_audit_log_id_seq'::regclass);


--
-- Name: leave_balances id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);


--
-- Name: leave_documents id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_documents ALTER COLUMN id SET DEFAULT nextval('public.leave_documents_id_seq'::regclass);


--
-- Name: leave_escalations id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_escalations ALTER COLUMN id SET DEFAULT nextval('public.leave_escalations_id_seq'::regclass);


--
-- Name: leave_policies id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_policies_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- Name: management_shifts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.management_shifts ALTER COLUMN id SET DEFAULT nextval('public.management_shifts_id_seq'::regclass);


--
-- Name: manual_leave_adjustments id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.manual_leave_adjustments ALTER COLUMN id SET DEFAULT nextval('public.manual_leave_adjustments_id_seq'::regclass);


--
-- Name: notification_templates id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: offline_verification_sync id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.offline_verification_sync ALTER COLUMN id SET DEFAULT nextval('public.offline_verification_sync_id_seq'::regclass);


--
-- Name: otp_verifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.otp_verifications ALTER COLUMN id SET DEFAULT nextval('public.otp_verifications_id_seq'::regclass);


--
-- Name: push_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications ALTER COLUMN id SET DEFAULT nextval('public.push_notifications_id_seq'::regclass);


--
-- Name: push_receipts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts ALTER COLUMN id SET DEFAULT nextval('public.push_receipts_id_seq'::regclass);


--
-- Name: regularization_approval_history id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_approval_history ALTER COLUMN id SET DEFAULT nextval('public.regularization_approval_history_id_seq'::regclass);


--
-- Name: regularization_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_notifications ALTER COLUMN id SET DEFAULT nextval('public.regularization_notifications_id_seq'::regclass);


--
-- Name: request_approvals id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals ALTER COLUMN id SET DEFAULT nextval('public.request_approvals_id_seq'::regclass);


--
-- Name: scheduled_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications ALTER COLUMN id SET DEFAULT nextval('public.scheduled_notifications_id_seq'::regclass);


--
-- Name: shift_timer_settings id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.shift_timer_settings ALTER COLUMN id SET DEFAULT nextval('public.shift_timer_settings_id_seq'::regclass);


--
-- Name: sms_delivery_log id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.sms_delivery_log ALTER COLUMN id SET DEFAULT nextval('public.sms_delivery_log_id_seq'::regclass);


--
-- Name: support_messages id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);


--
-- Name: task_activity_history id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_activity_history ALTER COLUMN id SET DEFAULT nextval('public.task_activity_history_id_seq'::regclass);


--
-- Name: task_attachments id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_attachments ALTER COLUMN id SET DEFAULT nextval('public.task_attachments_id_seq'::regclass);


--
-- Name: task_comments id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_comments ALTER COLUMN id SET DEFAULT nextval('public.task_comments_id_seq'::regclass);


--
-- Name: task_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_notifications ALTER COLUMN id SET DEFAULT nextval('public.task_notifications_id_seq'::regclass);


--
-- Name: tracking_analytics id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.tracking_analytics ALTER COLUMN id SET DEFAULT nextval('public.tracking_analytics_id_seq'::regclass);


--
-- Name: user_tracking_permissions id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_tracking_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: verification_audit_events id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_events ALTER COLUMN id SET DEFAULT nextval('public.verification_audit_events_id_seq'::regclass);


--
-- Name: verification_audit_logs id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.verification_audit_logs_id_seq'::regclass);


--
-- Name: verification_audit_steps id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_steps ALTER COLUMN id SET DEFAULT nextval('public.verification_audit_steps_id_seq'::regclass);


--
-- Name: workflow_levels id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.workflow_levels ALTER COLUMN id SET DEFAULT nextval('public.workflow_levels_id_seq'::regclass);


--
-- Name: approval_levels approval_levels_company_id_level_order_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_levels
    ADD CONSTRAINT approval_levels_company_id_level_order_key UNIQUE (company_id, level_order);


--
-- Name: approval_levels approval_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_levels
    ADD CONSTRAINT approval_levels_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_company_id_leave_type_id_min_days_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_company_id_leave_type_id_min_days_key UNIQUE (company_id, leave_type_id, min_days);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: attendance_regularization_requests attendance_regularization_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_pkey PRIMARY KEY (id);


--
-- Name: biometric_audit_logs biometric_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.biometric_audit_logs
    ADD CONSTRAINT biometric_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: companies companies_email_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_email_key UNIQUE (email);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_default_leave_balances company_default_leave_balance_company_id_leave_type_id_role_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_default_leave_balances
    ADD CONSTRAINT company_default_leave_balance_company_id_leave_type_id_role_key UNIQUE (company_id, leave_type_id, role);


--
-- Name: company_default_leave_balances company_default_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_default_leave_balances
    ADD CONSTRAINT company_default_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: company_geofences company_geofences_new_pkey1; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_pkey1 PRIMARY KEY (id);


--
-- Name: company_holidays company_holidays_company_date_unique; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_holidays
    ADD CONSTRAINT company_holidays_company_date_unique UNIQUE (company_id, date);


--
-- Name: company_holidays company_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_holidays
    ADD CONSTRAINT company_holidays_pkey PRIMARY KEY (id);


--
-- Name: company_tracking_settings company_tracking_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_tracking_settings
    ADD CONSTRAINT company_tracking_settings_pkey PRIMARY KEY (id);


--
-- Name: customer_notifications customer_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_pkey PRIMARY KEY (id);


--
-- Name: device_fingerprints device_fingerprints_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_fingerprints
    ADD CONSTRAINT device_fingerprints_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: email_rate_limits email_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.email_rate_limits
    ADD CONSTRAINT email_rate_limits_pkey PRIMARY KEY (email);


--
-- Name: employee_locations employee_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_pkey PRIMARY KEY (id);


--
-- Name: employee_schedule employee_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);


--
-- Name: employee_tasks employee_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: expense_documents expense_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expense_documents
    ADD CONSTRAINT expense_documents_pkey PRIMARY KEY (id);


--
-- Name: face_verification_logs face_verification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_logs
    ADD CONSTRAINT face_verification_logs_pkey PRIMARY KEY (id);


--
-- Name: face_verification_profiles face_verification_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_profiles
    ADD CONSTRAINT face_verification_profiles_pkey PRIMARY KEY (id);


--
-- Name: face_verification_profiles face_verification_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_profiles
    ADD CONSTRAINT face_verification_profiles_user_id_key UNIQUE (user_id);


--
-- Name: geofence_events geofence_events_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_pkey PRIMARY KEY (id);


--
-- Name: group_admin_shifts group_admin_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.group_admin_shifts
    ADD CONSTRAINT group_admin_shifts_pkey PRIMARY KEY (id);


--
-- Name: leave_balance_audit_log leave_balance_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balance_audit_log
    ADD CONSTRAINT leave_balance_audit_log_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_user_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_leave_type_id_year_key UNIQUE (user_id, leave_type_id, year);


--
-- Name: leave_documents leave_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT leave_documents_pkey PRIMARY KEY (id);


--
-- Name: leave_escalations leave_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_escalations
    ADD CONSTRAINT leave_escalations_pkey PRIMARY KEY (id);


--
-- Name: leave_policies leave_policies_leave_type_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_key UNIQUE (leave_type_id);


--
-- Name: leave_policies leave_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_name_company_id_unique; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_company_id_unique UNIQUE (name, company_id);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: management_shifts management_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.management_shifts
    ADD CONSTRAINT management_shifts_pkey PRIMARY KEY (id);


--
-- Name: manual_leave_adjustments manual_leave_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.manual_leave_adjustments
    ADD CONSTRAINT manual_leave_adjustments_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offline_verification_sync offline_verification_sync_offline_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.offline_verification_sync
    ADD CONSTRAINT offline_verification_sync_offline_id_key UNIQUE (offline_id);


--
-- Name: offline_verification_sync offline_verification_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.offline_verification_sync
    ADD CONSTRAINT offline_verification_sync_pkey PRIMARY KEY (id);


--
-- Name: otp_rate_limits otp_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.otp_rate_limits
    ADD CONSTRAINT otp_rate_limits_pkey PRIMARY KEY (phone_number);


--
-- Name: otp_records otp_records_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.otp_records
    ADD CONSTRAINT otp_records_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: push_notifications push_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_pkey PRIMARY KEY (id);


--
-- Name: push_receipts push_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT push_receipts_pkey PRIMARY KEY (id);


--
-- Name: regularization_approval_history regularization_approval_history_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_approval_history
    ADD CONSTRAINT regularization_approval_history_pkey PRIMARY KEY (id);


--
-- Name: regularization_notifications regularization_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_notifications
    ADD CONSTRAINT regularization_notifications_pkey PRIMARY KEY (id);


--
-- Name: request_approvals request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_pkey PRIMARY KEY (id);


--
-- Name: request_approvals request_approvals_request_id_level_id_approver_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_level_id_approver_id_key UNIQUE (request_id, level_id, approver_id);


--
-- Name: scheduled_notifications scheduled_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id);


--
-- Name: shift_timer_settings shift_timer_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.shift_timer_settings
    ADD CONSTRAINT shift_timer_settings_pkey PRIMARY KEY (id);


--
-- Name: sms_delivery_log sms_delivery_log_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.sms_delivery_log
    ADD CONSTRAINT sms_delivery_log_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: task_activity_history task_activity_history_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_activity_history
    ADD CONSTRAINT task_activity_history_pkey PRIMARY KEY (id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_notifications task_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_notifications
    ADD CONSTRAINT task_notifications_pkey PRIMARY KEY (id);


--
-- Name: tracking_analytics tracking_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.tracking_analytics
    ADD CONSTRAINT tracking_analytics_pkey PRIMARY KEY (id);


--
-- Name: leave_types unique_leave_type_name_company; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT unique_leave_type_name_company UNIQUE (name, company_id);


--
-- Name: push_receipts unique_receipt_id; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT unique_receipt_id UNIQUE (receipt_id);


--
-- Name: user_tracking_permissions unique_user_tracking_permission; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT unique_user_tracking_permission UNIQUE (user_id);


--
-- Name: user_tracking_permissions user_tracking_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT user_tracking_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_number_key UNIQUE (employee_number);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_audit_events verification_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_events
    ADD CONSTRAINT verification_audit_events_pkey PRIMARY KEY (id);


--
-- Name: verification_audit_logs verification_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_logs
    ADD CONSTRAINT verification_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: verification_audit_logs verification_audit_logs_session_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_logs
    ADD CONSTRAINT verification_audit_logs_session_id_key UNIQUE (session_id);


--
-- Name: verification_audit_steps verification_audit_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_steps
    ADD CONSTRAINT verification_audit_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_levels workflow_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.workflow_levels
    ADD CONSTRAINT workflow_levels_pkey PRIMARY KEY (id);


--
-- Name: workflow_levels workflow_levels_workflow_id_level_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.workflow_levels
    ADD CONSTRAINT workflow_levels_workflow_id_level_id_key UNIQUE (workflow_id, level_id);


--
-- Name: idx_approval_history_action_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_approval_history_action_timestamp ON public.regularization_approval_history USING btree (action_timestamp);


--
-- Name: idx_approval_history_approver_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_approval_history_approver_id ON public.regularization_approval_history USING btree (approver_id);


--
-- Name: idx_approval_history_request_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_approval_history_request_id ON public.regularization_approval_history USING btree (request_id);


--
-- Name: idx_approval_levels_company; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_approval_levels_company ON public.approval_levels USING btree (company_id);


--
-- Name: idx_approval_workflows_company; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_approval_workflows_company ON public.approval_workflows USING btree (company_id);


--
-- Name: idx_audit_user_action_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_audit_user_action_date ON public.biometric_audit_logs USING btree (user_id, action_type, created_at DESC);


--
-- Name: idx_biometric_audit_logs_action_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_biometric_audit_logs_action_type ON public.biometric_audit_logs USING btree (action_type);


--
-- Name: idx_biometric_audit_logs_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_biometric_audit_logs_created_at ON public.biometric_audit_logs USING btree (created_at DESC);


--
-- Name: idx_biometric_audit_logs_retention; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_biometric_audit_logs_retention ON public.biometric_audit_logs USING btree (retention_until) WHERE (retention_until IS NOT NULL);


--
-- Name: idx_biometric_audit_logs_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_biometric_audit_logs_user_id ON public.biometric_audit_logs USING btree (user_id);


--
-- Name: idx_chat_messages_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_chat_messages_user_id ON public.chat_messages USING btree (user_id);


--
-- Name: idx_company_default_leave_balances_company; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_default_leave_balances_company ON public.company_default_leave_balances USING btree (company_id);


--
-- Name: idx_company_geofences_active; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_geofences_active ON public.company_geofences USING btree (company_id) WHERE (radius > (0)::numeric);


--
-- Name: idx_company_geofences_company; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_geofences_company ON public.company_geofences USING btree (company_id);


--
-- Name: idx_company_geofences_coordinates; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_geofences_coordinates ON public.company_geofences USING gist (coordinates);


--
-- Name: idx_company_holidays_active; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_holidays_active ON public.company_holidays USING btree (is_active);


--
-- Name: idx_company_holidays_company_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_holidays_company_date ON public.company_holidays USING btree (company_id, date);


--
-- Name: idx_company_holidays_company_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_holidays_company_id ON public.company_holidays USING btree (company_id);


--
-- Name: idx_company_holidays_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_holidays_date ON public.company_holidays USING btree (date);


--
-- Name: idx_company_tracking_settings; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE UNIQUE INDEX idx_company_tracking_settings ON public.company_tracking_settings USING btree (company_id);


--
-- Name: idx_customer_notifications_email; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_customer_notifications_email ON public.customer_notifications USING btree (customer_email);


--
-- Name: idx_customer_notifications_sent_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_customer_notifications_sent_at ON public.customer_notifications USING btree (sent_at);


--
-- Name: idx_customer_notifications_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_customer_notifications_type ON public.customer_notifications USING btree (type);


--
-- Name: idx_device_fingerprints_blocked; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_fingerprints_blocked ON public.device_fingerprints USING btree (blocked) WHERE (blocked = true);


--
-- Name: idx_device_fingerprints_hash; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_fingerprints_hash ON public.device_fingerprints USING btree (fingerprint_hash);


--
-- Name: idx_device_fingerprints_trusted; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_fingerprints_trusted ON public.device_fingerprints USING btree (is_trusted) WHERE (is_trusted = true);


--
-- Name: idx_device_fingerprints_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_fingerprints_user_id ON public.device_fingerprints USING btree (user_id);


--
-- Name: idx_device_tokens_token; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_tokens_token ON public.device_tokens USING btree (token);


--
-- Name: idx_device_tokens_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_tokens_user_id ON public.device_tokens USING btree (user_id);


--
-- Name: idx_email_rate_limits_blocked_until; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_email_rate_limits_blocked_until ON public.email_rate_limits USING btree (blocked_until);


--
-- Name: idx_email_rate_limits_window_start; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_email_rate_limits_window_start ON public.email_rate_limits USING btree (window_start);


--
-- Name: idx_employee_locations_moving; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_moving ON public.employee_locations USING btree (user_id, is_moving) WHERE (is_moving = true);


--
-- Name: idx_employee_locations_outdoor; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_outdoor ON public.employee_locations USING btree (user_id, is_outdoor) WHERE (is_outdoor = true);


--
-- Name: idx_employee_locations_shift; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_shift ON public.employee_locations USING btree (shift_id, "timestamp" DESC);


--
-- Name: idx_employee_locations_user_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_user_timestamp ON public.employee_locations USING btree (user_id, "timestamp" DESC);


--
-- Name: idx_employee_shifts_face_verification; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_face_verification ON public.employee_shifts USING btree (face_verification_start, face_verification_end);


--
-- Name: idx_employee_shifts_location; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_location ON public.employee_shifts USING gist (location_history);


--
-- Name: idx_employee_shifts_start_time; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_start_time ON public.employee_shifts USING btree (start_time);


--
-- Name: idx_employee_shifts_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_status ON public.employee_shifts USING btree (status);


--
-- Name: idx_employee_shifts_verification_method; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_verification_method ON public.employee_shifts USING btree (verification_method) WHERE (verification_method IS NOT NULL);


--
-- Name: idx_employee_tasks_customer_contact; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_tasks_customer_contact ON public.employee_tasks USING btree (customer_contact);


--
-- Name: idx_employee_tasks_send_updates; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_tasks_send_updates ON public.employee_tasks USING btree (send_customer_updates);


--
-- Name: idx_error_logs_error_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_error_type ON public.error_logs USING btree (error_type);


--
-- Name: idx_error_logs_service; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_service ON public.error_logs USING btree (service);


--
-- Name: idx_error_logs_service_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_service_timestamp ON public.error_logs USING btree (service, "timestamp" DESC);


--
-- Name: idx_error_logs_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_timestamp ON public.error_logs USING btree ("timestamp" DESC);


--
-- Name: idx_error_logs_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_type ON public.error_logs USING btree (error_type);


--
-- Name: idx_error_logs_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_user_id ON public.error_logs USING btree (user_id);


--
-- Name: idx_error_logs_user_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_user_timestamp ON public.error_logs USING btree (user_id, "timestamp" DESC);


--
-- Name: idx_expenses_shift_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_expenses_shift_id ON public.expenses USING btree (shift_id);


--
-- Name: idx_face_logs_user_success_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_logs_user_success_date ON public.face_verification_logs USING btree (user_id, success, created_at DESC);


--
-- Name: idx_face_profiles_active_users; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_profiles_active_users ON public.face_verification_profiles USING btree (user_id, last_updated) WHERE (is_active = true);


--
-- Name: idx_face_verification_logs_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_logs_created_at ON public.face_verification_logs USING btree (created_at DESC);


--
-- Name: idx_face_verification_logs_device; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_logs_device ON public.face_verification_logs USING btree (device_fingerprint) WHERE (device_fingerprint IS NOT NULL);


--
-- Name: idx_face_verification_logs_shift_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_logs_shift_id ON public.face_verification_logs USING btree (shift_id);


--
-- Name: idx_face_verification_logs_success; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_logs_success ON public.face_verification_logs USING btree (success);


--
-- Name: idx_face_verification_logs_type_user; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_logs_type_user ON public.face_verification_logs USING btree (verification_type, user_id);


--
-- Name: idx_face_verification_logs_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_logs_user_id ON public.face_verification_logs USING btree (user_id);


--
-- Name: idx_face_verification_profiles_active; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_profiles_active ON public.face_verification_profiles USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_face_verification_profiles_hash; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_profiles_hash ON public.face_verification_profiles USING btree (face_encoding_hash);


--
-- Name: idx_face_verification_profiles_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_face_verification_profiles_user_id ON public.face_verification_profiles USING btree (user_id);


--
-- Name: idx_failed_verifications; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_failed_verifications ON public.face_verification_logs USING btree (user_id, created_at) WHERE (success = false);


--
-- Name: idx_geofence_events_geofence_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_geofence_id ON public.geofence_events USING btree (geofence_id);


--
-- Name: idx_geofence_events_shift_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_shift_id ON public.geofence_events USING btree (shift_id);


--
-- Name: idx_geofence_events_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_timestamp ON public.geofence_events USING btree ("timestamp");


--
-- Name: idx_geofence_events_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_user_id ON public.geofence_events USING btree (user_id);


--
-- Name: idx_group_admin_shifts_start_time; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_group_admin_shifts_start_time ON public.group_admin_shifts USING btree (start_time);


--
-- Name: idx_group_admin_shifts_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_group_admin_shifts_status ON public.group_admin_shifts USING btree (status);


--
-- Name: idx_leave_balances_leave_type_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_balances_leave_type_id ON public.leave_balances USING btree (leave_type_id);


--
-- Name: idx_leave_balances_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_balances_user_id ON public.leave_balances USING btree (user_id);


--
-- Name: idx_leave_escalations_request_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_escalations_request_id ON public.leave_escalations USING btree (request_id);


--
-- Name: idx_leave_requests_current_level; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_current_level ON public.leave_requests USING btree (current_level_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_group_admin; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_group_admin ON public.leave_requests USING btree (group_admin_id);


--
-- Name: idx_leave_requests_leave_type_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_leave_type_id ON public.leave_requests USING btree (leave_type_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_requests_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_user_id ON public.leave_requests USING btree (user_id);


--
-- Name: idx_leave_requests_workflow; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_workflow ON public.leave_requests USING btree (workflow_id);


--
-- Name: idx_leave_types_company_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_types_company_id ON public.leave_types USING btree (company_id);


--
-- Name: idx_management_shifts_start_time; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_management_shifts_start_time ON public.management_shifts USING btree (start_time);


--
-- Name: idx_management_shifts_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_management_shifts_status ON public.management_shifts USING btree (status);


--
-- Name: idx_manual_leave_adjustments_user_year; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_manual_leave_adjustments_user_year ON public.manual_leave_adjustments USING btree (user_id, year);


--
-- Name: idx_notification_templates_role; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_notification_templates_role ON public.notification_templates USING btree (role);


--
-- Name: idx_notification_templates_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_notification_templates_type ON public.notification_templates USING btree (type);


--
-- Name: idx_offline_verification_sync_offline_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_offline_verification_sync_offline_id ON public.offline_verification_sync USING btree (offline_id);


--
-- Name: idx_offline_verification_sync_synced_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_offline_verification_sync_synced_at ON public.offline_verification_sync USING btree (synced_at DESC);


--
-- Name: idx_offline_verification_sync_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_offline_verification_sync_user_id ON public.offline_verification_sync USING btree (user_id);


--
-- Name: idx_otp_rate_limits_blocked_until; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_rate_limits_blocked_until ON public.otp_rate_limits USING btree (blocked_until);


--
-- Name: idx_otp_rate_limits_window_start; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_rate_limits_window_start ON public.otp_rate_limits USING btree (window_start);


--
-- Name: idx_otp_records_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_records_created_at ON public.otp_records USING btree (created_at);


--
-- Name: idx_otp_records_email; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_records_email ON public.otp_records USING btree (email);


--
-- Name: idx_otp_records_expires_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_records_expires_at ON public.otp_records USING btree (expires_at);


--
-- Name: idx_otp_records_phone_number; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_records_phone_number ON public.otp_records USING btree (phone_number);


--
-- Name: idx_otp_records_purpose; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_records_purpose ON public.otp_records USING btree (purpose);


--
-- Name: idx_otp_user_purpose_expires; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_user_purpose_expires ON public.otp_verifications USING btree (user_id, purpose, expires_at DESC);


--
-- Name: idx_otp_verifications_active; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_verifications_active ON public.otp_verifications USING btree (verified, expires_at) WHERE (verified = false);


--
-- Name: idx_otp_verifications_expires_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_verifications_expires_at ON public.otp_verifications USING btree (expires_at);


--
-- Name: idx_otp_verifications_purpose; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_verifications_purpose ON public.otp_verifications USING btree (purpose);


--
-- Name: idx_otp_verifications_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_otp_verifications_user_id ON public.otp_verifications USING btree (user_id);


--
-- Name: idx_push_notifications_batch; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_batch ON public.push_notifications USING btree (batch_id);


--
-- Name: idx_push_notifications_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_created_at ON public.push_notifications USING btree (created_at);


--
-- Name: idx_push_notifications_expiration; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_expiration ON public.push_notifications USING btree (expires_at);


--
-- Name: idx_push_notifications_sent; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_sent ON public.push_notifications USING btree (sent);


--
-- Name: idx_push_notifications_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_type ON public.push_notifications USING btree (type);


--
-- Name: idx_push_notifications_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_user_id ON public.push_notifications USING btree (user_id);


--
-- Name: idx_push_receipts_notification_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_receipts_notification_id ON public.push_receipts USING btree (notification_id);


--
-- Name: idx_push_receipts_processed; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_receipts_processed ON public.push_receipts USING btree (processed);


--
-- Name: idx_recent_verifications; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_recent_verifications ON public.face_verification_logs USING btree (user_id, verification_type, created_at);


--
-- Name: idx_regularization_notifications_delivery_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_notifications_delivery_status ON public.regularization_notifications USING btree (delivery_status);


--
-- Name: idx_regularization_notifications_recipient_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_notifications_recipient_id ON public.regularization_notifications USING btree (recipient_id);


--
-- Name: idx_regularization_notifications_request_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_notifications_request_id ON public.regularization_notifications USING btree (request_id);


--
-- Name: idx_regularization_notifications_sent_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_notifications_sent_at ON public.regularization_notifications USING btree (sent_at);


--
-- Name: idx_regularization_requests_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_created_at ON public.attendance_regularization_requests USING btree (created_at);


--
-- Name: idx_regularization_requests_employee_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_employee_id ON public.attendance_regularization_requests USING btree (employee_id);


--
-- Name: idx_regularization_requests_group_admin_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_group_admin_id ON public.attendance_regularization_requests USING btree (group_admin_id);


--
-- Name: idx_regularization_requests_management_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_management_id ON public.attendance_regularization_requests USING btree (management_id);


--
-- Name: idx_regularization_requests_request_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_request_date ON public.attendance_regularization_requests USING btree (request_date);


--
-- Name: idx_regularization_requests_shift_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_shift_id ON public.attendance_regularization_requests USING btree (shift_id);


--
-- Name: idx_regularization_requests_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_regularization_requests_status ON public.attendance_regularization_requests USING btree (status);


--
-- Name: idx_request_approvals_approver; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_request_approvals_approver ON public.request_approvals USING btree (approver_id);


--
-- Name: idx_request_approvals_level; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_request_approvals_level ON public.request_approvals USING btree (level_id);


--
-- Name: idx_request_approvals_request; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_request_approvals_request ON public.request_approvals USING btree (request_id);


--
-- Name: idx_request_approvals_workflow; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_request_approvals_workflow ON public.request_approvals USING btree (workflow_id);


--
-- Name: idx_scheduled_notifications_scheduled_for; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_scheduled_notifications_scheduled_for ON public.scheduled_notifications USING btree (scheduled_for);


--
-- Name: idx_scheduled_notifications_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_scheduled_notifications_status ON public.scheduled_notifications USING btree (status);


--
-- Name: idx_scheduled_notifications_target_group_admin; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_scheduled_notifications_target_group_admin ON public.scheduled_notifications USING btree (target_group_admin_id);


--
-- Name: idx_shift_timer_notification; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_shift_timer_notification ON public.shift_timer_settings USING btree (notification_sent, end_time);


--
-- Name: idx_shift_timer_pending; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_shift_timer_pending ON public.shift_timer_settings USING btree (completed, end_time);


--
-- Name: idx_shift_timer_settings_auto_end; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_shift_timer_settings_auto_end ON public.shift_timer_settings USING btree (end_time, completed) WHERE (completed = false);


--
-- Name: idx_shift_timer_settings_pending; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_shift_timer_settings_pending ON public.shift_timer_settings USING btree (user_id, completed, end_time) WHERE (completed = false);


--
-- Name: idx_shift_timer_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_shift_timer_user_id ON public.shift_timer_settings USING btree (user_id);


--
-- Name: idx_sms_delivery_log_email; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_sms_delivery_log_email ON public.sms_delivery_log USING btree (email);


--
-- Name: idx_sms_delivery_log_phone_number; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_sms_delivery_log_phone_number ON public.sms_delivery_log USING btree (phone_number);


--
-- Name: idx_sms_delivery_log_provider; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_sms_delivery_log_provider ON public.sms_delivery_log USING btree (provider_name);


--
-- Name: idx_sms_delivery_log_sent_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_sms_delivery_log_sent_at ON public.sms_delivery_log USING btree (sent_at);


--
-- Name: idx_sms_delivery_log_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_sms_delivery_log_status ON public.sms_delivery_log USING btree (delivery_status);


--
-- Name: idx_task_activity_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_activity_created_at ON public.task_activity_history USING btree (created_at);


--
-- Name: idx_task_activity_task_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_activity_task_id ON public.task_activity_history USING btree (task_id);


--
-- Name: idx_task_activity_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_activity_type ON public.task_activity_history USING btree (activity_type);


--
-- Name: idx_task_activity_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_activity_user_id ON public.task_activity_history USING btree (user_id);


--
-- Name: idx_task_attachments_task_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments USING btree (task_id);


--
-- Name: idx_task_comments_comment_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_comments_comment_type ON public.task_comments USING btree (comment_type);


--
-- Name: idx_task_comments_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_comments_created_at ON public.task_comments USING btree (created_at);


--
-- Name: idx_task_comments_is_deleted; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_comments_is_deleted ON public.task_comments USING btree (is_deleted);


--
-- Name: idx_task_comments_task_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_comments_task_id ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_comments_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_comments_user_id ON public.task_comments USING btree (user_id);


--
-- Name: idx_task_notifications_delivery_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_notifications_delivery_status ON public.task_notifications USING btree (delivery_status);


--
-- Name: idx_task_notifications_recipient_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_notifications_recipient_id ON public.task_notifications USING btree (recipient_id);


--
-- Name: idx_task_notifications_sent_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_notifications_sent_at ON public.task_notifications USING btree (sent_at);


--
-- Name: idx_task_notifications_task_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_notifications_task_id ON public.task_notifications USING btree (task_id);


--
-- Name: idx_task_notifications_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_task_notifications_type ON public.task_notifications USING btree (notification_type);


--
-- Name: idx_tracking_analytics_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_tracking_analytics_date ON public.tracking_analytics USING btree (date);


--
-- Name: idx_tracking_analytics_user; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_tracking_analytics_user ON public.tracking_analytics USING btree (user_id);


--
-- Name: idx_tracking_analytics_user_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE UNIQUE INDEX idx_tracking_analytics_user_date ON public.tracking_analytics USING btree (user_id, date);


--
-- Name: idx_user_tracking_permissions; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_user_tracking_permissions ON public.user_tracking_permissions USING btree (user_id, tracking_precision);


--
-- Name: idx_users_biometric_consent; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_biometric_consent ON public.users USING btree (biometric_consent_given) WHERE (biometric_consent_given = true);


--
-- Name: idx_users_company_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_company_status ON public.users USING btree (company_id, status);


--
-- Name: idx_users_face_enabled; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_face_enabled ON public.users USING btree (face_enabled) WHERE (face_enabled = true);


--
-- Name: idx_users_face_locked; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_face_locked ON public.users USING btree (face_locked_until) WHERE (face_locked_until IS NOT NULL);


--
-- Name: idx_users_face_registered; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_face_registered ON public.users USING btree (face_registered) WHERE (face_registered = true);


--
-- Name: idx_users_group_admin_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_group_admin_id ON public.users USING btree (group_admin_id);


--
-- Name: idx_users_management_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_management_id ON public.users USING btree (management_id);


--
-- Name: idx_users_mfa_enabled; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_mfa_enabled ON public.users USING btree (mfa_enabled);


--
-- Name: idx_users_mfa_otp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_mfa_otp ON public.users USING btree (mfa_otp, mfa_otp_expires);


--
-- Name: idx_users_token_version; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_token_version ON public.users USING btree (token_version);


--
-- Name: idx_verification_audit_events_audit_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_events_audit_id ON public.verification_audit_events USING btree (audit_log_id);


--
-- Name: idx_verification_audit_events_event_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_events_event_type ON public.verification_audit_events USING btree (event_type);


--
-- Name: idx_verification_audit_events_step_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_events_step_type ON public.verification_audit_events USING btree (step_type);


--
-- Name: idx_verification_audit_events_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_events_timestamp ON public.verification_audit_events USING btree ("timestamp" DESC);


--
-- Name: idx_verification_audit_logs_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_logs_created_at ON public.verification_audit_logs USING btree (created_at DESC);


--
-- Name: idx_verification_audit_logs_session_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_logs_session_id ON public.verification_audit_logs USING btree (session_id);


--
-- Name: idx_verification_audit_logs_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_logs_status ON public.verification_audit_logs USING btree (status);


--
-- Name: idx_verification_audit_logs_user_action; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_logs_user_action ON public.verification_audit_logs USING btree (user_id, shift_action, created_at DESC);


--
-- Name: idx_verification_audit_logs_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_logs_user_id ON public.verification_audit_logs USING btree (user_id);


--
-- Name: idx_verification_audit_steps_audit_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_steps_audit_id ON public.verification_audit_steps USING btree (audit_log_id);


--
-- Name: idx_verification_audit_steps_completed; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_steps_completed ON public.verification_audit_steps USING btree (completed);


--
-- Name: idx_verification_audit_steps_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_verification_audit_steps_type ON public.verification_audit_steps USING btree (step_type);


--
-- Name: idx_workflow_levels_workflow; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_workflow_levels_workflow ON public.workflow_levels USING btree (workflow_id);


--
-- Name: employee_tasks task_activity_trigger; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER task_activity_trigger AFTER INSERT OR UPDATE ON public.employee_tasks FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();


--
-- Name: employee_shifts trigger_auto_ended_shift; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER trigger_auto_ended_shift BEFORE UPDATE ON public.employee_shifts FOR EACH ROW EXECUTE FUNCTION public.update_auto_ended_shift();


--
-- Name: company_holidays trigger_update_company_holidays_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER trigger_update_company_holidays_updated_at BEFORE UPDATE ON public.company_holidays FOR EACH ROW EXECUTE FUNCTION public.update_company_holidays_updated_at();


--
-- Name: chat_messages update_chat_messages_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_geofences update_company_geofences_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_company_geofences_updated_at BEFORE UPDATE ON public.company_geofences FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: email_rate_limits update_email_rate_limits_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_email_rate_limits_updated_at BEFORE UPDATE ON public.email_rate_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: geofence_events update_geofence_events_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_geofence_events_updated_at BEFORE UPDATE ON public.geofence_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_geofences update_geofences_timestamp; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_geofences_timestamp BEFORE UPDATE ON public.company_geofences FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: otp_rate_limits update_otp_rate_limits_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_otp_rate_limits_updated_at BEFORE UPDATE ON public.otp_rate_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: otp_records update_otp_records_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_otp_records_updated_at BEFORE UPDATE ON public.otp_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_tracking_permissions update_permissions_timestamp; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_permissions_timestamp BEFORE UPDATE ON public.user_tracking_permissions FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: attendance_regularization_requests update_regularization_requests_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_regularization_requests_updated_at BEFORE UPDATE ON public.attendance_regularization_requests FOR EACH ROW EXECUTE FUNCTION public.update_regularization_updated_at_column();


--
-- Name: company_tracking_settings update_settings_timestamp; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_settings_timestamp BEFORE UPDATE ON public.company_tracking_settings FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approval_levels approval_levels_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_levels
    ADD CONSTRAINT approval_levels_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: approval_workflows approval_workflows_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: approval_workflows approval_workflows_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: attendance_regularization_requests attendance_regularization_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_regularization_requests attendance_regularization_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_regularization_requests attendance_regularization_requests_final_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_final_approved_by_fkey FOREIGN KEY (final_approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_regularization_requests attendance_regularization_requests_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_regularization_requests attendance_regularization_requests_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_management_id_fkey FOREIGN KEY (management_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_regularization_requests attendance_regularization_requests_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.attendance_regularization_requests
    ADD CONSTRAINT attendance_regularization_requests_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE CASCADE;


--
-- Name: biometric_audit_logs biometric_audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.biometric_audit_logs
    ADD CONSTRAINT biometric_audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: biometric_audit_logs biometric_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.biometric_audit_logs
    ADD CONSTRAINT biometric_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: company_default_leave_balances company_default_leave_balances_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_default_leave_balances
    ADD CONSTRAINT company_default_leave_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_default_leave_balances company_default_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_default_leave_balances
    ADD CONSTRAINT company_default_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: company_geofences company_geofences_new_company_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_company_id_fkey1 FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_geofences company_geofences_new_created_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: company_tracking_settings company_tracking_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_tracking_settings
    ADD CONSTRAINT company_tracking_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: device_fingerprints device_fingerprints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_fingerprints
    ADD CONSTRAINT device_fingerprints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: device_tokens device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_locations employee_locations_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE CASCADE;


--
-- Name: employee_locations employee_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_schedule employee_schedule_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_shifts employee_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_shifts employee_shifts_verification_override_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_verification_override_by_fkey FOREIGN KEY (verification_override_by) REFERENCES public.users(id);


--
-- Name: employee_tasks employee_tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_tasks employee_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: error_logs error_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: face_verification_logs face_verification_logs_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_logs
    ADD CONSTRAINT face_verification_logs_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE SET NULL;


--
-- Name: face_verification_logs face_verification_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_logs
    ADD CONSTRAINT face_verification_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: face_verification_profiles face_verification_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.face_verification_profiles
    ADD CONSTRAINT face_verification_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: company_holidays fk_company_holidays_company_id; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_holidays
    ADD CONSTRAINT fk_company_holidays_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_holidays fk_company_holidays_created_by; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_holidays
    ADD CONSTRAINT fk_company_holidays_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: company_holidays fk_company_holidays_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_holidays
    ADD CONSTRAINT fk_company_holidays_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_shift; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_shift FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE SET NULL;


--
-- Name: geofence_events geofence_events_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id);


--
-- Name: geofence_events geofence_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: group_admin_shifts group_admin_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.group_admin_shifts
    ADD CONSTRAINT group_admin_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_balance_audit_log leave_balance_audit_log_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balance_audit_log
    ADD CONSTRAINT leave_balance_audit_log_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_balance_audit_log leave_balance_audit_log_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balance_audit_log
    ADD CONSTRAINT leave_balance_audit_log_modified_by_fkey FOREIGN KEY (modified_by) REFERENCES public.users(id);


--
-- Name: leave_balance_audit_log leave_balance_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balance_audit_log
    ADD CONSTRAINT leave_balance_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_balances leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_balances leave_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_documents leave_documents_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT leave_documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_policies leave_policies_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_current_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_current_level_id_fkey FOREIGN KEY (current_level_id) REFERENCES public.approval_levels(id);


--
-- Name: leave_requests leave_requests_final_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_final_approver_id_fkey FOREIGN KEY (final_approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: leave_types leave_types_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: management_shifts management_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.management_shifts
    ADD CONSTRAINT management_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: manual_leave_adjustments manual_leave_adjustments_adjusted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.manual_leave_adjustments
    ADD CONSTRAINT manual_leave_adjustments_adjusted_by_fkey FOREIGN KEY (adjusted_by) REFERENCES public.users(id);


--
-- Name: manual_leave_adjustments manual_leave_adjustments_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.manual_leave_adjustments
    ADD CONSTRAINT manual_leave_adjustments_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: manual_leave_adjustments manual_leave_adjustments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.manual_leave_adjustments
    ADD CONSTRAINT manual_leave_adjustments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offline_verification_sync offline_verification_sync_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.offline_verification_sync
    ADD CONSTRAINT offline_verification_sync_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: otp_verifications otp_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_notifications push_notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- Name: push_notifications push_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_receipts push_receipts_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT push_receipts_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.push_notifications(id) ON DELETE CASCADE;


--
-- Name: regularization_approval_history regularization_approval_history_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_approval_history
    ADD CONSTRAINT regularization_approval_history_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: regularization_approval_history regularization_approval_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_approval_history
    ADD CONSTRAINT regularization_approval_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.attendance_regularization_requests(id) ON DELETE CASCADE;


--
-- Name: regularization_notifications regularization_notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_notifications
    ADD CONSTRAINT regularization_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: regularization_notifications regularization_notifications_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.regularization_notifications
    ADD CONSTRAINT regularization_notifications_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.attendance_regularization_requests(id) ON DELETE CASCADE;


--
-- Name: request_approvals request_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: request_approvals request_approvals_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.approval_levels(id);


--
-- Name: request_approvals request_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.leave_requests(id);


--
-- Name: request_approvals request_approvals_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: scheduled_notifications scheduled_notifications_target_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_target_group_admin_id_fkey FOREIGN KEY (target_group_admin_id) REFERENCES public.users(id);


--
-- Name: scheduled_notifications scheduled_notifications_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);


--
-- Name: scheduled_notifications scheduled_notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- Name: shift_timer_settings shift_timer_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.shift_timer_settings
    ADD CONSTRAINT shift_timer_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sms_delivery_log sms_delivery_log_otp_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.sms_delivery_log
    ADD CONSTRAINT sms_delivery_log_otp_record_id_fkey FOREIGN KEY (otp_record_id) REFERENCES public.otp_records(id);


--
-- Name: support_messages support_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_activity_history task_activity_history_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_activity_history
    ADD CONSTRAINT task_activity_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.employee_tasks(id) ON DELETE CASCADE;


--
-- Name: task_activity_history task_activity_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_activity_history
    ADD CONSTRAINT task_activity_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.employee_tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.employee_tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_notifications task_notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_notifications
    ADD CONSTRAINT task_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_notifications task_notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.task_notifications
    ADD CONSTRAINT task_notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.employee_tasks(id) ON DELETE CASCADE;


--
-- Name: tracking_analytics tracking_analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.tracking_analytics
    ADD CONSTRAINT tracking_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_tracking_permissions user_tracking_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT user_tracking_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: users users_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_management_id_fkey FOREIGN KEY (management_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_audit_events verification_audit_events_audit_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_events
    ADD CONSTRAINT verification_audit_events_audit_log_id_fkey FOREIGN KEY (audit_log_id) REFERENCES public.verification_audit_logs(id) ON DELETE CASCADE;


--
-- Name: verification_audit_logs verification_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_logs
    ADD CONSTRAINT verification_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_audit_steps verification_audit_steps_audit_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.verification_audit_steps
    ADD CONSTRAINT verification_audit_steps_audit_log_id_fkey FOREIGN KEY (audit_log_id) REFERENCES public.verification_audit_logs(id) ON DELETE CASCADE;


--
-- Name: workflow_levels workflow_levels_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.workflow_levels
    ADD CONSTRAINT workflow_levels_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.approval_levels(id);


--
-- Name: workflow_levels workflow_levels_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.workflow_levels
    ADD CONSTRAINT workflow_levels_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: avnadmin
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- Name: SCHEMA topology; Type: ACL; Schema: -; Owner: avnadmin
--

REVOKE ALL ON SCHEMA topology FROM avnadmin;
GRANT CREATE ON SCHEMA topology TO avnadmin;
GRANT USAGE ON SCHEMA topology TO avnadmin WITH GRANT OPTION;


--
-- Name: TABLE layer; Type: ACL; Schema: topology; Owner: postgres
--

GRANT ALL ON TABLE topology.layer TO avnadmin WITH GRANT OPTION;


--
-- Name: TABLE topology; Type: ACL; Schema: topology; Owner: postgres
--

GRANT ALL ON TABLE topology.topology TO avnadmin WITH GRANT OPTION;


--
-- Name: TABLE spatial_ref_sys; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,DELETE,UPDATE ON TABLE public.spatial_ref_sys TO avnadmin WITH GRANT OPTION;


--
-- Name: SEQUENCE topology_id_seq; Type: ACL; Schema: topology; Owner: postgres
--

GRANT USAGE ON SEQUENCE topology.topology_id_seq TO avnadmin WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict vcugLsfSli4CDWxTXDL1YcomECGvsvgwIDP1ZaofeyZ1ANX2jC1gdXjZjtUYMwy

