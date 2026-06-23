import { Modal, GhostBtn, Select } from "./Modal";
import { toast } from "sonner";
import api from "@/lib/api";

const STATUSES = ["pending", "paid", "processing", "design_approved", "printing", "packed", "shipped", "delivered", "cancelled", "returned"];

const OrderDetail = ({ open, onClose, order, onChanged }) => {
  if (!order) return null;

  const updateStatus = async (status) => {
    await api.put(`/admin/orders/${order.id}/status`, { status });
    toast.success("Status updated");
    onChanged();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Order ${order.order_number}`} size="lg">
      <div className="space-y-5" data-testid="order-detail">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-1">Customer</div>
            <div className="font-semibold">{order.customer?.name || "—"}</div>
            <div className="text-[#52525B]">{order.customer?.email}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-1">Placed</div>
            <div className="font-semibold">{new Date(order.created_at).toLocaleString()}</div>
            <div className="text-[#52525B]">Payment: {order.payment_status} · {order.payment_method}</div>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Shipping Address</div>
          <div className="text-sm bg-black/5 p-3 rounded-sm">
            {order.address?.name}, {order.address?.phone}<br />
            {order.address?.line1}<br />
            {order.address?.city}, {order.address?.state} - {order.address?.pincode}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Items</div>
          <div className="space-y-2">
            {order.items.map((it, idx) => (
              <div key={idx} className="flex gap-3 p-3 bg-white border border-black/10 rounded-sm">
                {it.product_image && <img src={it.product_image} alt="" className="w-14 h-14 object-cover rounded-sm" />}
                <div className="flex-1">
                  <div className="font-semibold text-sm">{it.product_name}</div>
                  <div className="text-xs text-[#52525B]">Qty {it.quantity} · ₹{it.unit_price}</div>
                  {it.variants && <div className="text-xs text-[#52525B] mt-0.5">{Object.entries(it.variants).map(([k, v]) => `${k}:${v}`).join(" · ")}</div>}
                  {it.custom_text && <div className="text-xs text-[#52525B] italic">&ldquo;{it.custom_text}&rdquo;</div>}
                </div>
                <div className="font-display font-bold">₹{it.amount}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-black/5 rounded-sm">
          <span className="font-display font-bold text-lg">Total</span>
          <span className="font-display font-black text-2xl">₹{order.total}</span>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Status</div>
          <Select value={order.status} onChange={e => updateStatus(e.target.value)} data-testid="order-status-select">
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </Select>
        </div>

        <div className="flex justify-end pt-4 border-t border-black/5">
          <GhostBtn onClick={onClose} data-testid="order-close-btn">Close</GhostBtn>
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetail;
