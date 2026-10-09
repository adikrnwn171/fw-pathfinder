import type React from "react";
import type { HopRowDetail } from "@/types/api";

interface PathHopsSectionProps {
    hops: HopRowDetail[]
    configuredFirewalls?: string[] | null;
}

export const PathHopsSection: React.FC<PathHopsSectionProps> = ( {hops, configuredFirewalls = []} ) => {
    return (
        <>
            <div className="rounded overflow-hidden bg-white">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-border bg-secondary text-xs font-semibold tracking-wider text-muted-foreground">
                        <th className="px-3 py-3">No</th>
                        <th className="px-3 py-3">Firewall Name</th>
                        <th className="px-3 py-3">VSys</th>
                        <th className="px-3 py-3">Src Zone</th>
                        <th className="px-3 py-3">Source IP</th>
                        <th className="px-3 py-3">Src Segment</th>
                        <th className="px-3 py-3">Dst Zone</th>
                        <th className="px-3 py-3">Dst IP</th>
                        <th className="px-3 py-3">Dst Segment</th>
                        <th className="px-3 py-3">Service</th>
                        <th className="px-3 py-3">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {hops.map((hop, index) => {
                            const isConfigured = (configuredFirewalls || []).includes(hop.firewall_name);
                            return (
                            // <tr key={index} className={`border-b border-border last:border-0 ${index % 2 === 1 ? 'bg-secondary/50' : ''}`}>
                                <tr
                                    key={index}
                                    className={`border-b border-border last:border-0 transition-colors ${
                                        isConfigured
                                        ? "bg-emerald-100/70 text-emerald-900 font-medium"
                                        : index % 2 === 1
                                        ? "bg-secondary/50"
                                        : ""
                                    }`}
                                    >
                                    <td className="px-3 py-3">{index + 1}</td>
                                    <td className="px-3 py-3">{hop.firewall_name}</td>
                                    <td className="px-3 py-3 ">{hop.vsys}</td>
                                    <td className="px-3 py-3">{hop.src_zone}</td>
                                    <td className="px-3 py-3">{hop.source_ip}</td>
                                    <td className="px-3 py-3">{hop.src_segment}</td>
                                    <td className="px-3 py-3">{hop.dst_zone}</td>
                                    <td className="px-3 py-3">{hop.destination_ip}</td>
                                    <td className="px-3 py-3">{hop.dst_segment}</td>
                                    <td className="px-3 py-3">{hop.services}</td>
                                    <td className="px-3 py-3">{hop.notes}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </div>
        </>
    )
}