DO $$
DECLARE
  test_user uuid := 'e2434fd6-1c77-4669-8908-a971c38b024a';
  notification uuid := '3d1c94ad-ef44-4c79-943c-1d378a7c7532';
  target_line text := 'U0123456789abcdef0123456789abcdef';
  result boolean;
  count_value integer;
BEGIN
  INSERT INTO auth.users (id) VALUES (test_user);
  INSERT INTO public.line_link_requests (nonce, user_id)
  VALUES ('0123456789abcdef0123456789abcdef', test_user);
  SELECT public.complete_line_link('0123456789abcdef0123456789abcdef', target_line) INTO result;
  IF NOT result THEN RAISE EXCEPTION 'Link did not complete'; END IF;
  SELECT public.complete_line_link('0123456789abcdef0123456789abcdef', target_line) INTO result;
  IF result THEN RAISE EXCEPTION 'Nonce was reused'; END IF;

  INSERT INTO public.app_notifications (id, recipient_id, event_type, related_id, title, body)
  VALUES (notification, test_user, 'job_application', gen_random_uuid(), 'Test', 'Test');
  SELECT count(*) INTO count_value FROM public.line_application_deliveries
  WHERE notification_id = notification AND line_user_id = target_line AND status = 'pending';
  IF count_value <> 1 THEN RAISE EXCEPTION 'Delivery was not queued'; END IF;
  SELECT count(*) INTO count_value FROM public.claim_line_application_deliveries()
  WHERE notification_id = notification AND status = 'sending' AND attempts = 1;
  IF count_value <> 1 THEN RAISE EXCEPTION 'Delivery was not claimed'; END IF;
  SELECT count(*) INTO count_value FROM public.claim_line_application_deliveries()
  WHERE notification_id = notification;
  IF count_value <> 0 THEN RAISE EXCEPTION 'Delivery was claimed twice'; END IF;

  PERFORM public.remove_line_link(test_user);
  SELECT count(*) INTO count_value FROM public.line_application_deliveries
  WHERE notification_id = notification;
  IF count_value <> 0 THEN RAISE EXCEPTION 'Unlink did not remove delivery'; END IF;
  SELECT count(*) INTO count_value FROM public.line_notification_links WHERE user_id = test_user;
  IF count_value <> 0 THEN RAISE EXCEPTION 'Unlink did not remove link'; END IF;

  INSERT INTO public.line_link_requests (nonce, user_id, expires_at)
  VALUES ('expired0123456789abcdef', test_user, now() - interval '1 minute');
  SELECT public.complete_line_link('expired0123456789abcdef', target_line) INTO result;
  IF result THEN RAISE EXCEPTION 'Expired nonce was accepted'; END IF;
END;
$$;
