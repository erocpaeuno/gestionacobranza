import { ReciboGenerado, UsuarioConfig } from '../types';

export function cleanPhoneNumber(phone: string): string {
  // Remove spaces, hyphens, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

export function generateWhatsAppMessage(
  recibo: ReciboGenerado,
  config: UsuarioConfig
): string {
  const {
    id,
    fecha_hora,
    cliente,
    prestamo,
    tipo_operacion,
    cuotas_afectadas,
    total_cuotas,
    total_mora,
    saldo_favor_usado,
    total_cobrado,
    saldo_restante_prestamo,
    cuotas_restantes,
    proximo_vencimiento,
  } = recibo;

  const operacionTitulo =
    tipo_operacion === 'CUOTA'
      ? 'PAGO DE CUOTA(S)'
      : tipo_operacion === 'AMORTIZACION'
      ? 'AMORTIZACIÓN EXTRAORDINARIA'
      : 'CANCELACIÓN TOTAL DE CRÉDITO';

  let lines: string[] = [
    `🧾 *COMPROBANTE DE PAGO*`,
    `🏢 *${config.nombre_marca.toUpperCase()}*`,
    `📍 ${config.direccion || 'Oficina Principal'}`,
    `📞 Soporte: ${config.telefono || ''}`,
    `----------------------------------------`,
    `📋 *N° Recibo:* ${id}`,
    `📅 *Fecha y Hora:* ${fecha_hora}`,
    `👤 *Cliente:* ${cliente.nombres} ${cliente.apellidos}`,
    `🪪 *DNI:* ${cliente.dni}`,
    `📑 *Préstamo:* ${prestamo.id} (${prestamo.tipo_credito})`,
    `----------------------------------------`,
    `📌 *OPERACIÓN:* ${operacionTitulo}`,
  ];

  if (tipo_operacion === 'CUOTA') {
    lines.push(
      `🔢 *Cuotas Pagadas:* ${cuotas_afectadas.map((c) => `#${c.numero}`).join(', ')}`
    );
    cuotas_afectadas.forEach((c) => {
      lines.push(
        `  • Cuota #${c.numero}: $${c.monto.toFixed(2)} ${c.mora > 0 ? `(+Mora: $${c.mora.toFixed(2)})` : ''}`
      );
    });
  } else if (tipo_operacion === 'AMORTIZACION') {
    lines.push(`💰 *Abono Amortizado:* $${total_cobrado.toFixed(2)}`);
    if (cuotas_afectadas && cuotas_afectadas.length > 0) {
      lines.push(`🔢 *Detalle de Cuotas Amortizadas:*`);
      cuotas_afectadas.forEach((c) => {
        lines.push(
          `  • Cuota #${c.numero}: Abono $${c.monto.toFixed(2)} | *Saldo actual cuota:* $${(c.saldo_actual ?? 0).toFixed(2)}`
        );
      });
    }
  } else {
    lines.push(`🎉 *Liquidación Total Préstamo:* $${total_cobrado.toFixed(2)}`);
    lines.push(`✨ *Estado Préstamo:* 100% CANCELADO`);
  }

  if (total_mora > 0 && tipo_operacion === 'CUOTA') {
    lines.push(`⚠️ *Total Mora:* $${total_mora.toFixed(2)}`);
  }

  if (saldo_favor_usado > 0) {
    lines.push(`💳 *Saldo a favor aplicado:* -$${saldo_favor_usado.toFixed(2)}`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`💵 *TOTAL PAGADO:* $${total_cobrado.toFixed(2)}`);
  lines.push(`----------------------------------------`);

  if (tipo_operacion !== 'CANCELACION') {
    lines.push(`📊 *Saldo Actual Restante del Crédito:* $${saldo_restante_prestamo.toFixed(2)}`);
    lines.push(`⏳ *Cuotas Restantes:* ${cuotas_restantes}`);
    if (proximo_vencimiento) {
      lines.push(`🗓️ *Próximo Vencimiento:* ${proximo_vencimiento}`);
    }
  } else {
    lines.push(`✅ *Felicidades! Préstamo cancelado en su totalidad.*`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`Cobrador: ${config.representante || 'Administración'}`);
  lines.push(`¡Muchas gracias por su preferencia y puntualidad! 🙏`);

  return lines.join('\n');
}

export function getWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
