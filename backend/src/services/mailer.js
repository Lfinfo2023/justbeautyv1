import { escapeHtml, renderMailShell } from "../core/templates.js";

export const createMailer = async (env) => {
  const logoUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/logo.jpg`;
  const buildServiceLabel = (service) => [service.category, service.name].filter(Boolean).join(" - ");

  console.log("SMTP ENV", {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secureRaw: env.SMTP_SECURE,
    secureParsed: env.SMTP_SECURE === "true",
    user: env.SMTP_USER,
    from: env.SMTP_FROM_EMAIL,
    admin: env.BOOKING_ADMIN_EMAIL || env.ADMIN_EMAIL,
  });

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("SMTP disabled: missing configuration");
    return {
      sendBookingCreatedEmails: async () => {},
      sendBookingStatusEmail: async () => {},
      sendContactEmail: async () => {},
    };
  }

  try {
    const { default: nodemailer } = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === "true",
      requireTLS: true,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      logger: true,
      debug: true,
    });

    await transporter.verify();
    console.log("SMTP transporter ready");

    return {
      async sendBookingCreatedEmails({ booking, service, actionLinks }) {
        const serviceLabel = buildServiceLabel(service);
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Just Beauty",
          title: `Votre demande pour ${serviceLabel} est bien enregistrée`,
          intro: `Bonjour ${booking.client_name}, votre demande de rendez-vous à bien été reçue et attend maintenant la confirmation de Justine.`,
          details: [
            { label: "Cliente", value: booking.client_name },
            { label: "Service", value: serviceLabel },
            { label: "Date", value: booking.booking_date },
            { label: "Heure", value: booking.booking_time.slice(0, 5) },
            { label: "Telephone", value: booking.client_phone || "Non renseigne" },
          ],
          closing: "Merci pour votre confiance. Pensez aussi à vérifier votre dossier spam ou courrier indésirable.",
        });

        const adminCta = `
          <a href="${escapeHtml(actionLinks.confirm)}" style="display:inline-block;margin-right:12px;margin-bottom:12px;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Confirmer</a>
          <a href="${escapeHtml(actionLinks.refuse)}" style="display:inline-block;margin-right:12px;margin-bottom:12px;text-decoration:none;background:#fffaf7;color:#7a5146;padding:14px 20px;border-radius:999px;border:1px solid #d9b8a8;">Refuser</a>
        `;

        const adminHtml = renderMailShell({
          logoUrl,
          eyebrow: "Nouvelle réservation",
          title: `Nouvelle demande: ${booking.client_name} - ${serviceLabel}`,
          intro: "Vous pouvez traiter ce rendez-vous directement depuis cet email, sans passer par l'administration.",
          details: [
            { label: "Cliente", value: booking.client_name },
            { label: "Email", value: booking.client_email },
            { label: "Telephone", value: booking.client_phone || "Non renseigne" },
            { label: "Service", value: serviceLabel },
            { label: "Date", value: booking.booking_date },
            { label: "Heure", value: booking.booking_time.slice(0, 5) },
          ],
          cta: adminCta,
          closing: "En cas de refus, la cliente sera invitée à reprogrammer son rendez-vous.",
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: booking.client_email,
          subject: `Just Beauty | Demande recue - ${booking.client_name} - ${serviceLabel}`,
          html: clientHtml,
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: env.BOOKING_ADMIN_EMAIL || env.SMTP_FROM_EMAIL || env.ADMIN_EMAIL,
          subject: `Just Beauty | Nouvelle reservation - ${booking.client_name} - ${serviceLabel}`,
          html: adminHtml,
        });
      },

      async sendBookingStatusEmail({ booking, service, publicBaseUrl }) {
        const isConfirmed = booking.status === "confirmed";
        const serviceLabel = buildServiceLabel(service);

        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: isConfirmed ? "Rendez-vous confirmé" : "Rendez-vous à reprogrammer",
          title: isConfirmed
            ? `Votre rendez-vous pour ${serviceLabel} est confirmé`
            : `Votre rendez-vous pour ${serviceLabel} n'a pas pu être maintenu`,
          intro: isConfirmed
            ? `Bonjour ${booking.client_name}, bonne nouvelle: votre rendez-vous vient d'être confirmé par Just Beauty.`
            : `Bonjour ${booking.client_name}, votre demande n'a malheureusement pas pu être maintenue sur le creneau choisi.`,
          details: [
            { label: "Cliente", value: booking.client_name },
            { label: "Service", value: serviceLabel },
            { label: "Date", value: booking.booking_date },
            { label: "Heure", value: booking.booking_time.slice(0, 5) },
          ],
          cta: !isConfirmed
            ? `<a href="${escapeHtml(`${publicBaseUrl}/rendez-vous`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Reprogrammer mon rendez-vous</a>`
            : "",
          closing: isConfirmed
            ? "Pensez à vérifier également vos spams si vous ne retrouvez pas nos prochains emails."
            : "Nous vous invitons à reprogrammer un nouveau moment cocooning via le site quand vous le souhaitez.",
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: booking.client_email,
          subject: isConfirmed
            ? `Just Beauty | Rendez-vous confirmé - ${booking.client_name} - ${serviceLabel}`
            : `Just Beauty | Rendez-vous à reprogrammer - ${booking.client_name} - ${serviceLabel}`,
          html: clientHtml,
        });
      },

      async sendContactEmail({ message }) {
        const adminHtml = renderMailShell({
          logoUrl,
          eyebrow: "Nouveau message",
          title: "Le formulaire de contact vient d'etre utilisé",
          intro: "Un message client vient d'etre envoyé depuis le site Just Beauty.",
          details: [
            { label: "Nom", value: message.client_name },
            { label: "Email", value: message.client_email },
            { label: "Telephone", value: message.client_phone || "Non renseigne" },
            { label: "Message", value: message.message },
          ],
          closing: "Vous pouvez répondre directement à l'adresse email de la cliente si nécessaire.",
        });

        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Just Beauty",
          title: "Votre message a bien été envoyé",
          intro: `Bonjour ${message.client_name}, nous avons bien reçu votre message et nous reviendrons vers vous rapidement.`,
          details: [
            { label: "Email", value: message.client_email },
            { label: "Telephone", value: message.client_phone || "Non renseigne" },
            { label: "Message", value: message.message },
          ],
          closing: "Merci pour votre confiance.",
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: env.CONTACT_ADMIN_EMAIL || env.BOOKING_ADMIN_EMAIL || env.ADMIN_EMAIL,
          replyTo: message.client_email,
          subject: "Just Beauty | Nouveau message de contact",
          html: adminHtml,
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: message.client_email,
          subject: "Just Beauty | Nous avons bien reçu votre message",
          html: clientHtml,
        });
      },
    };
  } catch (error) {
    console.error("Mailer init error:", error);
    return {
      sendBookingCreatedEmails: async () => {},
      sendBookingStatusEmail: async () => {},
      sendContactEmail: async () => {},
    };
  }
};
